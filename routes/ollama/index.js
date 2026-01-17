
/**
 * routes/ollama/index.js
 * Self-contained SQL agent with persistent memory (memory.json in same folder).
 */

const routes = require("express").Router();
const { Ollama } = require("ollama");
const { sequelize } = require("../../models/");
const { QueryTypes } = require("sequelize");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const util = require("node:util");

// -------------------
// Config (env-tunable)
// -------------------
// const MODEL_DEFAULT = process.env.OLLAMA_MODEL || "llama3.1:8b"; // ensure this exists locally
const MODEL_DEFAULT = process.env.OLLAMA_MODEL || "ministral-3:3b"; // ensure this exists locally
// const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://192.168.1.7:11434";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

const LOG_LEVEL = process.env.LOG_LEVEL || "debug"; // debug | info | warn | error
const MAX_ITERATIONS = parseInt(process.env.AGENT_MAX_ITERATIONS || "10", 10);
const CHAT_TIMEOUT_MS = parseInt(process.env.OLLAMA_CHAT_TIMEOUT_MS || "600000", 10); // 10m
const TOOL_TIMEOUT_MS = parseInt(process.env.TOOL_TIMEOUT_MS || "30000", 10); // 30s per DB query
const MAX_ROWS = parseInt(process.env.AGENT_MAX_ROWS || "1000", 10);
const REPEAT_LIMIT = parseInt(process.env.AGENT_REPEAT_LIMIT || "3", 10);

// Approximate context control (char-based heuristic)
const MAX_HISTORY_CHARS = parseInt(process.env.MAX_HISTORY_CHARS || "26000", 10);

// Model generation options (Compute-heavy settings suitable for SQL reasoning)
const MODEL_OPTIONS = {
  // Solid context length for SQL agents on CPU with 32 GB RAM.
  num_ctx: 3072,

  // Enough budget for multi-step tool reasoning without dragging.
  num_predict: 256,

  // Deterministic & stable for SQL/tool work.
  temperature: 0.1,
  top_p: 0.9,

  // Fully utilize 8 logical threads (4C/8T).
  num_thread: 8,

  // CPU-only: keep GPU knobs unset.
  // gpu_layers: 0,

  // Quality/latency tuning (safe defaults):
  top_k: 40,
  repeat_penalty: 1.1,
  repeat_last_n: 256,
  num_batch: 256,      // Increase to 384–512 if RAM headroom is plenty and you want faster prompt ingestion
  seed: 1,             // Determinism across runs (handy for debugging)
};

const ollama = new Ollama({ host: OLLAMA_HOST });

// -------------------
// Logging helpers
// -------------------
function levelToNum(lvl) {
  return { debug: 10, info: 20, warn: 30, error: 40 }[lvl] ?? 20;
}
const LOG_THRESHOLD = levelToNum(LOG_LEVEL);

function makeLogger(rid) {
  function base(level, msg, extra) {
    if (levelToNum(level) < LOG_THRESHOLD) return;
    const ts = new Date().toISOString();
    if (extra !== undefined) {
      console.log(`[ollama/chatDB] [${level}] [${rid}] ${ts} ${msg}`, extra);
    } else {
      console.log(`[ollama/chatDB] [${level}] [${rid}] ${ts} ${msg}`);
    }
  }
  return {
    debug: (m, e) => base("debug", m, e),
    info: (m, e) => base("info", m, e),
    warn: (m, e) => base("warn", m, e),
    error: (m, e) => base("error", m, e),
  };
}

function msSince(startNs) {
  const delta = process.hrtime.bigint() - startNs;
  return Number(delta) / 1e6;
}
function preview(obj, len = 400) {
  try {
    const str = typeof obj === "string" ? obj : JSON.stringify(obj);
    if (str.length <= len) return str;
    return str.slice(0, len) + ` …(+${str.length - len} chars)`;
  } catch {
    return "<unserializable>";
  }
}
function oneLine(str) {
  return String(str).replace(/\s+/g, " ").trim();
}
function isHeadersTimeout(err) {
  return (
    err?.code === "UND_ERR_HEADERS_TIMEOUT" ||
    err?.cause?.code === "UND_ERR_HEADERS_TIMEOUT"
  );
}

async function chatWithTimeout(payload, ms, log) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const t0 = process.hrtime.bigint();
    const res = await ollama.chat({ ...payload, signal: controller.signal, stream: false });
    log.info(`Model call completed in ${msSince(t0).toFixed(1)} ms`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// -------------------
// SQL safety & helpers
// -------------------
function validateSelect(query) {
  const q = String(query || "").trim();
  if (!/^\s*select\b/i.test(q)) {
    return { ok: false, reason: "Query must start with SELECT" };
  }
  if (/;.*\S/.test(q)) {
    return { ok: false, reason: "Multiple statements detected after a semicolon" };
  }
  if (/(--|\/\*)/.test(q)) {
    return { ok: false, reason: "SQL comments are not allowed" };
  }
  return { ok: true };
}
function isSafeIdentifier(name) {
  return typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}
function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function withQueryTimeout(fn, ms = TOOL_TIMEOUT_MS) {
  return sequelize.transaction(async (t) => {
    await sequelize.query(`SET LOCAL statement_timeout = ${ms};`, { transaction: t });
    return fn(t);
  });
}

async function executeSQL(query) {
  const check = validateSelect(query);
  if (!check.ok) {
    throw new Error(
      `Only safe, single SELECT queries are allowed. Reason: ${check.reason}`
    );
  }
  const rows = await withQueryTimeout(
    (t) => sequelize.query(query, { type: QueryTypes.SELECT, transaction: t }),
    TOOL_TIMEOUT_MS
  );
  return Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : rows;
}

// -------------------
// PERSISTENT MEMORY (memory.json in same folder)
// -------------------
const MEMORY_FILE = path.join(__dirname, "memory.json");

// In-memory structure with defaults
let agentMemory = {
  version: 1,
  updatedAt: new Date().toISOString(),
  schema_knowledge: { },
  relationships: { },
  business_rules: {},
  user_preferences: {},
  synonyms: {},
  facts_learned: [],
};

// simple async mutex
let _lock = Promise.resolve();
function withLock(fn) {
  const next = _lock.then(fn, fn);
  _lock = next.catch(() => {}); // prevent lock chain break
  return next;
}

// Ensure memory file exists
async function ensureMemoryFile() {
  try {
    await fsp.access(MEMORY_FILE, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(MEMORY_FILE, JSON.stringify(agentMemory, null, 2), "utf8");
  }
}

// Load memory at module init
async function loadMemory(log) {
  try {
    await ensureMemoryFile();
    const raw = await fsp.readFile(MEMORY_FILE, "utf8");
    const json = JSON.parse(raw);
    agentMemory = { ...agentMemory, ...json };
    log?.info(`Persistent memory loaded from memory.json`);
  } catch (e) {
    log?.warn(`Failed to load memory.json, starting fresh: ${e.message}`);
  }
}

// Atomic save (write to temp then rename)
async function saveMemory(log) {
  return withLock(async () => {
    const tmp = MEMORY_FILE + ".tmp";
    agentMemory.updatedAt = new Date().toISOString();
    const data = JSON.stringify(agentMemory, null, 2);
    await fsp.writeFile(tmp, data, "utf8");
    await fsp.rename(tmp, MEMORY_FILE);
    log?.info(`Persistent memory saved (${data.length} bytes)`);
  });
}

// Helpers to update memory
function upsertTableColumns(schema, table, columns) {
  if (!agentMemory.schema_knowledge[schema]) agentMemory.schema_knowledge[schema] = {};
  const colList = Array.from(new Set((columns || []).map(String)));
  agentMemory.schema_knowledge[schema][table] = {
    columns: colList,
    lastSeen: new Date().toISOString(),
  };
}

function upsertForeignKeys(schema, table, fks) {
  const key = `${schema}.${table}`;
  const mapped = (fks || []).map((r) => ({
    column: r.column_name || r.column || r.kcu_column_name || r.columnName,
    foreign_table_schema:
      r.foreign_table_schema || r.fk_schema || r.referenced_table_schema,
    foreign_table_name:
      r.foreign_table_name || r.fk_table || r.referenced_table_name,
    foreign_column_name:
      r.foreign_column_name || r.fk_column || r.referenced_column_name,
  }));
  agentMemory.relationships[key] = mapped.filter(
    (x) => x.column && x.foreign_table_schema && x.foreign_table_name && x.foreign_column_name
  );
}

function appendFact(fact) {
  const s = String(fact).trim();
  if (!s) return;
  if (!agentMemory.facts_learned.includes(s)) {
    agentMemory.facts_learned.push(s);
  }
}

function writeKV(section, key, value) {
  if (!["business_rules", "user_preferences"].includes(section)) {
    throw new Error("Section must be 'business_rules' or 'user_preferences'");
  }
  agentMemory[section][String(key)] = String(value);
}

function rememberSynonyms(canonical, synonyms) {
  const c = String(canonical);
  const arr = (Array.isArray(synonyms) ? synonyms : [synonyms])
    .map((s) => String(s))
    .filter((s) => s && s !== c);
  const existing = new Set(agentMemory.synonyms[c] || []);
  arr.forEach((s) => existing.add(s));
  agentMemory.synonyms[c] = Array.from(existing);
}

// Build memory excerpt for prompt (trim large memory)
function memoryForPrompt(maxChars = 4000) {
  const pick = {
    schema_knowledge: agentMemory.schema_knowledge,
    relationships: agentMemory.relationships,
    business_rules: agentMemory.business_rules,
    synonyms: agentMemory.synonyms,
    facts_learned: agentMemory.facts_learned.slice(-50),
    user_preferences: agentMemory.user_preferences,
    updatedAt: agentMemory.updatedAt,
  };
  let s = JSON.stringify(pick);
  if (s.length <= maxChars) return s;
  pick.facts_learned = pick.facts_learned.slice(-20);
  s = JSON.stringify(pick);
  if (s.length <= maxChars) return s;
  const minimal = {
    schema_knowledge: pick.schema_knowledge,
    relationships: pick.relationships,
    facts_learned: pick.facts_learned.slice(-10),
    updatedAt: pick.updatedAt,
  };
  return JSON.stringify(minimal);
}

// Initialize memory at load time
loadMemory();

// -------------------
// Tools
// -------------------
const tools = [
  // SQL tools
  {
    type: "function",
    function: {
      name: "run_sql_query",
      description:
        "Executes a single safe SQL SELECT query and returns rows as JSON. Always include a LIMIT unless you really need the full result.",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description:
              'A single SELECT statement (no comments, no multiple statements). In PostgreSQL, ALWAYS put identifiers (table and column names) in double quotes, e.g., SELECT "id" FROM "Clients".',
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_schemas",
      description: "Lists non-system schemas available in the database (e.g., 'public').",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tables",
      description:
        "Lists tables in a given schema (default 'public'). Use this to discover what you can query.",
      parameters: {
        type: "object",
        properties: {
          schema: { type: "string", description: "Schema name (default 'public')" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "describe_table",
      description:
        "Describes a table: columns, data types, nullability, and default values.",
      parameters: {
        type: "object",
        required: ["schema", "table"],
        properties: {
          schema: { type: "string", description: "Schema name" },
          table: { type: "string", description: "Table name" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_foreign_keys",
      description:
        "Lists foreign keys and relationships for a given table, useful to plan joins.",
      parameters: {
        type: "object",
        required: ["schema", "table"],
        properties: {
          schema: { type: "string", description: "Schema name" },
          table: { type: "string", description: "Table name" },
        },
      },
    },
  },

  // MEMORY tools
  {
    type: "function",
    function: {
      name: "write_memory",
      description:
        "Persist a key/value pair to memory under a section. Section must be 'business_rules' or 'user_preferences'.",
      parameters: {
        type: "object",
        required: ["section", "key", "value"],
        properties: {
          section: { type: "string", enum: ["business_rules", "user_preferences"] },
          key: { type: "string" },
          value: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "append_fact",
      description: "Append a durable fact to memory (strings only, avoid transient info).",
      parameters: {
        type: "object",
        required: ["fact"],
        properties: {
          fact: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_synonyms",
      description:
        "Remember synonyms for a canonical term, e.g., canonical='BANK AL HABIB LIMITED', synonyms=['AL HABIB','HABIB BANK'].",
      parameters: {
        type: "object",
        required: ["canonical", "synonyms"],
        properties: {
          canonical: { type: "string" },
          synonyms: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_schema_info",
      description:
        "Persist columns or relationships for a table in memory. Use after describe_table/list_foreign_keys.",
      parameters: {
        type: "object",
        required: ["schema", "table"],
        properties: {
          schema: { type: "string" },
          table: { type: "string" },
          columns: { type: "array", items: { type: "string" } },
          relationships: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                foreign_table_schema: { type: "string" },
                foreign_table_name: { type: "string" },
                foreign_column_name: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
];

// -------------------
// Tool executors (SQL + Memory)
// -------------------
async function exec_list_schemas() {
  const rows = await sequelize.query(
    `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT LIKE 'pg_%'
        AND schema_name <> 'information_schema'
      ORDER BY schema_name;
    `,
    { type: QueryTypes.SELECT }
  );
  return rows;
}

async function exec_list_tables(args = {}) {
  const schema = args.schema || "public";
  const rows = await sequelize.query(
    `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema = :schema
      ORDER BY table_name;
    `,
    { replacements: { schema }, type: QueryTypes.SELECT }
  );
  // Auto-learn: record table names (no columns yet)
  if (!agentMemory.schema_knowledge[schema]) agentMemory.schema_knowledge[schema] = {};
  rows.forEach((r) => {
    const t = r.table_name;
    if (!agentMemory.schema_knowledge[schema][t]) {
      agentMemory.schema_knowledge[schema][t] = { columns: [], lastSeen: new Date().toISOString() };
    } else {
      agentMemory.schema_knowledge[schema][t].lastSeen = new Date().toISOString();
    }
  });
  await saveMemory();
  return rows;
}

async function exec_describe_table(args) {
  const schema = args?.schema;
  const table = args?.table;
  if (!schema || !table) {
    throw new Error("describe_table requires { schema, table }");
  }
  const rows = await sequelize.query(
    `
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default
      FROM information_schema.columns c
      WHERE c.table_schema = :schema
        AND c.table_name = :table
      ORDER BY c.ordinal_position;
    `,
    { replacements: { schema, table }, type: QueryTypes.SELECT }
  );
  // Auto-learn: store columns
  upsertTableColumns(schema, table, rows.map((r) => r.column_name));
  await saveMemory();
  return rows;
}

async function exec_list_foreign_keys(args) {
  const schema = args?.schema;
  const table = args?.table;
  if (!schema || !table) {
    throw new Error("list_foreign_keys requires { schema, table }");
  }
  const rows = await sequelize.query(
    `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name   AS foreign_table_name,
        ccu.column_name  AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = :schema
        AND tc.table_name = :table
      ORDER BY tc.constraint_name, kcu.ordinal_position;
    `,
    { replacements: { schema, table }, type: QueryTypes.SELECT }
  );
  // Auto-learn: store relationships
  upsertForeignKeys(schema, table, rows);
  await saveMemory();
  return rows;
}

// Accept { query } or { sql }
async function exec_run_sql_query(args) {
  const query =
    typeof args?.query === "string"
      ? args.query
      : typeof args?.sql === "string"
      ? args.sql
      : null;

  if (!query) {
    throw new Error(
      'run_sql_query requires { query: string } (or { sql: string }).'
    );
  }
  const rows = await executeSQL(query);
  return rows;
}

// MEMORY executors
async function exec_write_memory(args) {
  const section = String(args?.section || "");
  const key = String(args?.key || "");
  const value = String(args?.value ?? "");
  if (!section || !key) throw new Error("write_memory requires { section, key, value }");
  writeKV(section, key, value);
  await saveMemory();
  return { success: true };
}

async function exec_append_fact(args) {
  const fact = String(args?.fact || "");
  if (!fact) throw new Error("append_fact requires { fact }");
  appendFact(fact);
  await saveMemory();
  return { success: true };
}

async function exec_remember_synonyms(args) {
  const canonical = String(args?.canonical || "");
  const synonyms = Array.isArray(args?.synonyms) ? args.synonyms : [];
  if (!canonical || synonyms.length === 0)
    throw new Error("remember_synonyms requires { canonical, synonyms[] }");
  rememberSynonyms(canonical, synonyms);
  await saveMemory();
  return { success: true };
}

async function exec_upsert_schema_info(args) {
  const schema = String(args?.schema || "public");
  const table = String(args?.table || "");
  const columns = Array.isArray(args?.columns) ? args.columns.map(String) : null;
  const relationships = Array.isArray(args?.relationships) ? args.relationships : null;
  if (!table) throw new Error("upsert_schema_info requires { schema, table }");

  if (columns && columns.length) upsertTableColumns(schema, table, columns);
  if (relationships && relationships.length) upsertForeignKeys(schema, table, relationships);
  await saveMemory();
  return { success: true };
}

// -------------------
// Conversation helpers
// -------------------
function normalizeIncomingMessages(raw = []) {
  // Keep user/assistant and tool messages; drop any system provided by client
  return raw
    .map((m) => {
      if (!m || !m.role) return null;
      if (m.role === "system") return null; // we inject our own system

      let content = m.content;
      if (typeof content !== "string") {
        try { content = JSON.stringify(content); } catch { content = String(content); }
      }

      const normalized = { role: m.role, content };
      if (m.role === "tool" && m.name) normalized.name = String(m.name);
      return normalized;
    })
    .filter(Boolean);
}

function truncateConversation(messages, maxChars = MAX_HISTORY_CHARS) {
  // Keep the tail within approx char budget; always keep the last 1–2 turns
  let total = 0;
  const out = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const size = (m.content || "").length + 40; // role/name overhead
    if (total + size > maxChars && out.length >= 4) break; // ensure some context kept
    out.push(m);
    total += size;
  }
  return out.reverse();
}

// -------------------
// System prompt builder
// -------------------
function buildSystemContent(memoryExcerpt) {
  return [
    // --- CORE BEHAVIOR RULES (Phi3-optimized) ---
    "You are Odyssey, an autonomous SQL agent. For ANY user request involving database entities (tables, accounts, IDs, names, companies, banks, balances, customers, vendors, invoices, payments, or ANY lookup), you MUST call a tool immediately.",
    "You MUST NOT answer with normal text when a tool call is needed. Tool-first at all times.",
    "NEVER ask the user for schema or table names. ALWAYS discover schema and tables using list_schemas, list_tables, and describe_table.",
    "NEVER say you lack access to the database. You DO have access through tools.",

    // — AUTO SEARCH BEHAVIOR —
    "If the user provides ANY identifier (name, account name, company name, bank name, invoice, number, ID, text value, reference string, etc.), you MUST immediately search the database for it.",
    "If the user mentions ANY entity (e.g., 'SULTEX INDUSTRIES account'), you MUST begin searching ALL tables automatically.",
    "You MUST NEVER ask clarifying questions if ANY searchable text is provided.",
    "Clarifying questions are ONLY allowed if the user request contains ZERO meaningful nouns (e.g., 'find it', 'get the info', 'do it').",

    // --- HOW TO SEARCH ---
    "To find where a value exists, ALWAYS perform the following sequence:",
    "1. list_schemas",
    "2. For each schema → list_tables",
    "3. For each table → describe_table",
    "4. For each table → use run_sql_query to search across discovered columns using ILIKE on ::text. Example: SELECT * FROM \"schema\".\"table\" WHERE (\"col1\"::text ILIKE '%VALUE%' OR \"col2\"::text ILIKE '%VALUE%') LIMIT 200;",
    "Continue until matches are found.",
    "Return all matches.",

    // --- DIRECT TABLE USAGE ---
    "If the user gives a table name explicitly (e.g., Child_Accounts, Master_Accounts, Ledger), use it directly with run_sql_query.",

    // --- SQL RULES ---
    "You are an expert PostgreSQL analyst.",
    "In PostgreSQL ALWAYS wrap table and column identifiers in double quotes, e.g., SELECT \"id\" FROM \"Clients\".",
    "Unquoted identifiers become lowercase; quoted identifiers preserve case.",
    "run_sql_query must ALWAYS use { \"query\": \"...\" }.",
    "Only SELECT statements allowed. NEVER generate INSERT, UPDATE, DELETE, DROP, CREATE, or any modification.",
    "Always include LIMIT 100–500 unless the user explicitly requests unlimited results.",

    // --- TOOL USAGE RULES ---
    "Use list_schemas → list_tables → describe_table → run_sql_query (build WHERE with ILIKE across relevant ::text columns) to discover where data is stored.",
    "If entity name is given but table is unknown, AUTOMATICALLY search all tables until matches are found.",
    "NEVER ask the user which table to use.",
    "NEVER ask schema questions.",

    // --- MEMORY RULES ---
    "Whenever you discover stable facts (schemas, tables, columns, foreign keys, synonyms, business rules), store them using memory tools.",
    "Never store query results or temporary values in memory.",

    // --- TOOL SET ---
    "You can only use these tools: list_schemas, list_tables, describe_table, list_foreign_keys, run_sql_query, write_memory, append_fact, remember_synonyms, upsert_schema_info.",

    // --- DEFAULTS ---
    "If schema is not specified, default to schema='public'.",
    "If user provides a table name, assume it exists and verify with describe_table.",
    "If a tool call is required, your output MUST be ONLY the tool call JSON. No extra text.",

    // --- OUTPUT RULES ---
    "If the user asks to fetch, find, view, get, search, lookup, show, or retrieve something, ALWAYS assume it means querying the database.",
    "NEVER respond with explanations before tool calls.",

    // --- PERSISTED MEMORY ---
    "Here is your previously learned knowledge (persisted across restarts):",
    memoryExcerpt,
  ].join(" ");
}

// -------------------
// Main route
// -------------------
routes.post("/chatDB", async (req, res) => {
  const rid = req.id || req.headers["x-request-id"] || crypto.randomUUID();
  const log = makeLogger(rid);
  const requestStart = process.hrtime.bigint();

  try {
    log.info(`REQUEST START POST /ollama/chatDB`);
    log.debug(`Tools available: ${tools.map((t) => t.function.name).join(", ")}`);

    // 1) Normalize & validate incoming conversation
    const incomingRaw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const incoming = normalizeIncomingMessages(incomingRaw);
    const last = incoming[incoming.length - 1];
    const userInput = last?.content;

    log.debug(`Incoming messages count (normalized): ${incoming.length}`);
    log.debug(`Last user input preview: ${preview(userInput)}`);

    if (typeof userInput !== "string" || !userInput.trim()) {
      log.warn(`Invalid payload: messages[*].content missing or not a non-empty string`);
      return res.status(400).json({
        status: "error",
        error: "Invalid payload: messages[*].content must be a non-empty string.",
      });
    }

    // 2) Ensure memory is loaded
    await loadMemory(log);

    // 3) Build system prompt with memory excerpt
    const memoryExcerpt = memoryForPrompt(1000);
    const systemContent = buildSystemContent(memoryExcerpt);

    // 4) Truncate history to fit context and prepend system
    const trimmed = truncateConversation(incoming, MAX_HISTORY_CHARS);
    const model = typeof req.body?.model === "string" && req.body.model.trim()
      ? req.body.model.trim()
      : MODEL_DEFAULT;

    const messages = [
      { role: "system", content: systemContent },
      ...trimmed,
    ];

    // 5) Initial model call
    log.info(`Calling model "${model}" (initial) with ${messages.length} message(s) ...`);

    let response;
    try {
      response = await chatWithTimeout(
        { model, messages, tools, options: MODEL_OPTIONS },
        CHAT_TIMEOUT_MS,
        log
      );
    } catch (err) {
      if (isHeadersTimeout(err)) {
        log.error(`Headers timeout waiting for model (initial)`);
        return res.status(504).json({
          status: "error",
          error: "Ollama did not respond before the timeout.",
          hint: [
            `Daemon host: ${OLLAMA_HOST}`,
            `Consider reducing iterations, num_predict, and context size, or using a smaller model`,
          ],
        });
      }
      throw err;
    }

    log.debug(`Assistant initial response preview: ${preview(response?.message?.content)}`);
    if (response?.message) {
      messages.push(response.message);
    }

    if (response?.message?.tool_calls?.length) {
      const calls = response.message.tool_calls.map((c, i) => ({
        idx: i,
        name: c?.function?.name,
        argsPreview: preview(c?.function?.arguments, 200),
      }));
      log.info(`Tool calls requested by model: ${response.message.tool_calls.length}`, calls);
    } else {
      log.info(`No tool calls requested in initial response.`);
    }

    // 6) Tool loop with stall detection
    let iterations = 0;
    const seenCalls = new Map(); // key: name+args JSON → count

    while (response?.message?.tool_calls?.length && iterations < MAX_ITERATIONS) {
      iterations++;
      log.info(`--- TOOL ITERATION ${iterations}/${MAX_ITERATIONS} ---`);

      for (const [idx, call] of response.message.tool_calls.entries()) {
        const toolName = call?.function?.name;
        log.info(`Executing tool [${idx}]: ${toolName}`);

        // Parse tool arguments robustly
        let args;
        try {
          args =
            typeof call?.function?.arguments === "string"
              ? JSON.parse(call.function.arguments)
              : call?.function?.arguments || {};
          log.debug(`Tool args parsed: ${preview(args)}`);
        } catch (e) {
          const toolErr = {
            role: "tool",
            name: toolName || "unknown_tool",
            content: JSON.stringify({
              error: "INVALID_TOOL_ARGUMENTS",
              message: `Invalid tool arguments: ${e.message}`,
              hint:
                'Ensure arguments are valid JSON. For SQL, provide { "query": "SELECT ..." } with identifiers in double quotes.',
            }),
          };
          if (call?.id) toolErr.tool_call_id = call.id;
          messages.push(toolErr);
          log.warn(`Invalid tool arguments, returning error to model`, { message: e.message });
          continue;
        }

        // Normalize arguments for run_sql_query (accept sql → query)
        if (toolName === "run_sql_query" && args && args.sql && !args.query) {
          args = { ...args, query: args.sql };
        }

        // Stall detection: repeated same tool+args
        const sig = `${toolName}|${oneLine(preview(args, 300))}`;
        const count = (seenCalls.get(sig) || 0) + 1;
        seenCalls.set(sig, count);
        if (count > REPEAT_LIMIT) {
          log.warn(`Stall detected: tool "${toolName}" called with same args > ${REPEAT_LIMIT} times. Breaking.`);
          messages.push({
            role: "assistant",
            content:
              "I attempted the same tool call multiple times without making progress. I will stop to avoid wasting resources.",
          });
          // Break outer loops by clearing tool_calls
          response.message.tool_calls = [];
          break;
        }

        try {
          // Execute tool with timing
          const toolStart = process.hrtime.bigint();
          let rows;
          let toolResultForMemory = null;

          switch (toolName) {
            case "run_sql_query": {
              const qRaw = args.query ?? "";
              const v = validateSelect(qRaw);
              log.info(`run_sql_query: query preview: ${preview(oneLine(qRaw), 500)}`);
              log.debug(`run_sql_query: safe=${v.ok}${v.ok ? "" : ` reason="${v.reason}"`}`);
              rows = await exec_run_sql_query(args);
              break;
            }
            case "list_schemas":
              log.info(`list_schemas: executing`);
              rows = await exec_list_schemas();
              break;
            case "list_tables": {
              const schema = args.schema || "public";
              log.info(`list_tables: schema="${schema}"`);
              rows = await exec_list_tables(args);
              toolResultForMemory = { type: "tables", schema, rows };
              break;
            }
            case "describe_table": {
              const schema = args?.schema;
              const table = args?.table;
              log.info(`describe_table: schema="${schema}", table="${table}"`);
              rows = await exec_describe_table(args);
              toolResultForMemory = {
                type: "columns",
                schema,
                table,
                columns: rows.map((r) => r.column_name),
              };
              break;
            }
            case "list_foreign_keys": {
              const schema = args?.schema;
              const table = args?.table;
              log.info(`list_foreign_keys: schema="${schema}", table="${table}"`);
              rows = await exec_list_foreign_keys(args);
              toolResultForMemory = { type: "fks", schema, table, rows };
              break;
            }

            // MEMORY tools
            case "write_memory": {
              rows = await exec_write_memory(args);
              break;
            }
            case "append_fact": {
              rows = await exec_append_fact(args);
              break;
            }
            case "remember_synonyms": {
              rows = await exec_remember_synonyms(args);
              break;
            }
            case "upsert_schema_info": {
              rows = await exec_upsert_schema_info(args);
              break;
            }

            default: {
              // Unknown tool → tell model explicitly (no crash).
              const toolErr = {
                role: "tool",
                name: toolName || "unknown_tool",
                content: JSON.stringify({
                  error: "UNKNOWN_TOOL",
                  message:
                    `Tool "${toolName}" is not available. Use only: list_schemas, list_tables, describe_table, list_foreign_keys, run_sql_query, write_memory, append_fact, remember_synonyms, upsert_schema_info.`,
                }),
              };
              if (call?.id) toolErr.tool_call_id = call.id;
              messages.push(toolErr);
              log.warn(`Unknown tool requested by model: ${toolName}`);
              continue;
            }
          }

          // If we saw discoverable schema info, store it automatically
          if (toolResultForMemory) {
            if (toolResultForMemory.type === "tables") {
              const { schema, rows: tbls } = toolResultForMemory;
              if (!agentMemory.schema_knowledge[schema]) agentMemory.schema_knowledge[schema] = {};
              tbls.forEach((r) => {
                const t = r.table_name;
                if (!agentMemory.schema_knowledge[schema][t]) {
                  agentMemory.schema_knowledge[schema][t] = { columns: [], lastSeen: new Date().toISOString() };
                } else {
                  agentMemory.schema_knowledge[schema][t].lastSeen = new Date().toISOString();
                }
              });
              await saveMemory(log);
            } else if (toolResultForMemory.type === "columns") {
              const { schema, table, columns } = toolResultForMemory;
              upsertTableColumns(schema, table, columns);
              await saveMemory(log);
            } else if (toolResultForMemory.type === "fks") {
              const { schema, table, rows: fks } = toolResultForMemory;
              upsertForeignKeys(schema, table, fks);
              await saveMemory(log);
            }
          }

          const took = msSince(toolStart).toFixed(1);
          const sample = Array.isArray(rows) && rows.length ? rows[0] : null;
          log.info(`${toolName}: returned ${Array.isArray(rows) ? rows.length : 0} row(s) in ${took} ms`);
          if (sample) log.debug(`${toolName}: sample row`, sample);

          // Push successful tool result
          const toolMessage = {
            role: "tool",
            name: toolName,
            content: JSON.stringify(Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : rows),
          };
          if (call?.id) toolMessage.tool_call_id = call.id;
          messages.push(toolMessage);
        } catch (err) {
          // Intercept DB/tool errors and provide corrective guidance to the LLM
          const pgCode = err?.original?.code || err?.parent?.code || err?.code;
          const sqlText = err?.original?.sql || err?.parent?.sql || err?.sql || undefined;

          let hint = "Inspect schema with list_schemas, list_tables, and describe_table, then retry.";
          if (pgCode === "42P01") {
            hint =
              'PostgreSQL could not find the table. Remember to put table and column names in double quotes, e.g., SELECT "id" FROM "Clients".';
          }
          if (/Only safe, single SELECT/.test(err.message)) {
            hint =
              'Use a single SELECT without comments or multiple statements, and quote identifiers, e.g., SELECT "id" FROM "Clients" LIMIT 100;';
          }

          log.error(`Tool execution error in ${toolName}: ${err.message}`, {
            pgCode,
            sqlPreview: preview(oneLine(sqlText || ""), 400),
          });

          const toolErr = {
            role: "tool",
            name: toolName || "run_sql_query",
            content: JSON.stringify({
              error: "TOOL_EXECUTION_ERROR",
              pgCode,
              message: err.message,
              sql: sqlText,
              hint,
            }),
          };
          if (call?.id) toolErr.tool_call_id = call.id;
          messages.push(toolErr);
        }
      }

      // Ask the model again with updated context (with timeout)
      log.info(`Calling model "${model}" (follow-up) with ${messages.length} message(s) ...`);
      try {
        response = await chatWithTimeout(
          { model, messages, tools, options: MODEL_OPTIONS },
          CHAT_TIMEOUT_MS,
          log
        );
      } catch (err) {
        if (isHeadersTimeout(err)) {
          log.error(`Headers timeout waiting for model (follow-up)`);
          return res.status(504).json({
            status: "error",
            error: "Ollama did not respond before the timeout.",
            hint: [
              `Daemon host: ${OLLAMA_HOST}`,
              `Consider reducing iterations (now ${MAX_ITERATIONS}), num_predict, and context size; or use a smaller model`,
            ],
          });
        }
        throw err;
      }

      log.debug(`Assistant follow-up response preview: ${preview(response?.message?.content)}`);

      if (response?.message?.tool_calls?.length) {
        const calls = response.message.tool_calls.map((c, i) => ({
          idx: i,
          name: c?.function?.name,
          argsPreview: preview(c?.function?.arguments, 200),
        }));
        log.info(`Tool calls requested by model (follow-up): ${response.message.tool_calls.length}`, calls);
      } else {
        log.info(`No tool calls requested in follow-up response.`);
      }

      if (response?.message) {
        messages.push(response.message);
      }
    }

    const finalText = response?.message?.content ?? "";
    log.info(`FINAL answer length: ${finalText.length}`);
    log.debug(`FINAL answer preview: ${preview(finalText, 800)}`);
    log.info(`REQUEST END POST /ollama/chatDB (total ${msSince(requestStart).toFixed(1)} ms)`);
    return res.json({
      status: "success",
      response: finalText,
      meta: {
        model,
        iterations,
        messagesSent: messages.length,
      },
    });
  } catch (error) {
    const rid2 = req.id || "-";
    console.error(
      `[ollama/chatDB] [error] [${rid2}] ${new Date().toISOString()} REQUEST ERROR: ${error.message}`,
      { stack: error.stack }
    );
    console.log(
      `[ollama/chatDB] [info] [${rid2}] ${new Date().toISOString()} REQUEST END (error) POST /ollama/chatDB`
    );
    return res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

module.exports = routes;
