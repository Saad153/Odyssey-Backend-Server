/*
 * Repairs the indexes on the pick-list tables (Ports / Destinations / Airports).
 *
 *   node scripts/fixPickListIndexes.js            # DRY RUN
 *   node scripts/fixPickListIndexes.js --commit
 *
 * TWO PROBLEMS
 *
 * 1. Runaway duplicate unique indexes.
 *    Destinations.name and Airports.airportCode are declared `unique: true` on
 *    the attribute itself. Sequelize's sync({alter:true}) cannot match an
 *    inline unique constraint against what is already in the database, so it
 *    adds ANOTHER one on every run - Destinations_name_key, _key1, _key2 ...
 *    That is one more index per server restart, for years:
 *        Destinations   76 indexes   432 MB of index on a 10 MB table
 *        Airports       81 indexes     7 MB of index on a 296 kB table
 *    Every insert and update maintains all of them, which is why writes to
 *    these tables crawl. This drops the duplicates, keeping exactly one.
 *
 *    The models are fixed alongside this: the inline `unique: true` is replaced
 *    with a NAMED entry in `indexes`, which sync can match by name and will
 *    therefore stop re-adding.
 *
 * 2. Ports has no index at all beyond its primary key.
 *    157,879 rows, and the pick-list search does
 *        portId ILIKE %x% OR portName ILIKE %x% OR portCountry ILIKE %x%
 *    which is a full sequential scan - measured at 400-800 ms per keystroke.
 *    Trigram indexes make a leading-wildcard ILIKE searchable; without them no
 *    btree can help, because the pattern does not anchor to the start.
 *
 * SAFETY
 *  - Dry run unless --commit; prints every index it would drop or create.
 *  - Dropping a redundant index cannot lose data - one equivalent unique index
 *    is always kept, so the constraint itself is never lifted.
 *  - Index creation is not transactional here on purpose: CREATE INDEX on
 *    157k rows briefly locks writes to Ports, and wrapping several of those in
 *    one transaction holds the lock for longer than doing them one at a time.
 */
const db = require('../models');
const { sequelize } = db;

const COMMIT = process.argv.slice(2).includes('--commit');

// name -> the one index to keep for each table's duplicated set
const DUP_SETS = [
  { table: 'Destinations', pattern: '^Destinations_name_key[0-9]*$', keep: 'Destinations_name_key' },
  { table: 'Airports', pattern: '^Airports_airportCode_key[0-9]*$', keep: 'Airports_airportCode_key' },
];

async function main() {
  await sequelize.authenticate();
  await db.syncPromise;

  console.log(COMMIT ? '*** COMMIT MODE - changes will be written ***'
                     : '--- DRY RUN - nothing will be written (pass --commit to apply) ---');

  /* ---------------- 1. duplicate unique indexes ---------------- */
  for (const { table, pattern, keep } of DUP_SETS) {
    // `isConstraint` matters: Sequelize created these as UNIQUE CONSTRAINTS,
    // and Postgres refuses DROP INDEX on an index that backs one - it has to be
    // ALTER TABLE ... DROP CONSTRAINT instead.
    const [rows] = await sequelize.query(`
      SELECT i.relname AS name, pg_relation_size(i.oid) AS bytes,
             EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.oid) AS "isConstraint"
        FROM pg_index x
        JOIN pg_class i ON i.oid = x.indexrelid
        JOIN pg_class t ON t.oid = x.indrelid
       WHERE t.relname = :table AND i.relname ~ :pattern
       ORDER BY i.relname
    `, { replacements: { table, pattern } });

    const drop = rows.filter((r) => r.name !== keep);
    const bytes = drop.reduce((n, r) => n + Number(r.bytes), 0);
    console.log(`\n${table}: ${rows.length} matching index(es), dropping ${drop.length}, ` +
                `keeping ${rows.some((r) => r.name === keep) ? keep : '(none matched - keeping the first)'}` +
                `  [~${(bytes / 1024 / 1024).toFixed(0)} MB reclaimed]`);

    if (!rows.some((r) => r.name === keep) && rows.length) {
      // Defensive: if the un-suffixed name is missing, keep the first rather
      // than dropping every unique index and losing the constraint.
      drop.shift();
      console.log(`   (kept ${rows[0].name} instead)`);
    }

    if (COMMIT) {
      let done = 0;
      for (const r of drop) {
        if (r.isConstraint) {
          await sequelize.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${r.name}"`);
        } else {
          await sequelize.query(`DROP INDEX IF EXISTS "${r.name}"`);
        }
        done++;
        if (done % 20 === 0) console.log(`   ...${done}/${drop.length}`);
      }
      console.log(`   dropped ${done}`);
    }
  }

  /* ---------------- 2. searchable indexes on Ports ---------------- */
  // pg_trgm ships with PostgreSQL but is not enabled by default.
  const [[ext]] = await sequelize.query(
    `SELECT count(*)::int AS n FROM pg_extension WHERE extname = 'pg_trgm'`);
  console.log(`\npg_trgm extension installed: ${ext.n ? 'yes' : 'no'}`);

  const wanted = [
    ['ports_portname_trgm', `CREATE INDEX IF NOT EXISTS "ports_portname_trgm" ON "Ports" USING gin ("portName" gin_trgm_ops)`],
    ['ports_portid_trgm', `CREATE INDEX IF NOT EXISTS "ports_portid_trgm" ON "Ports" USING gin ("portId" gin_trgm_ops)`],
    ['ports_portcountry_trgm', `CREATE INDEX IF NOT EXISTS "ports_portcountry_trgm" ON "Ports" USING gin ("portCountry" gin_trgm_ops)`],
    ['destinations_name_trgm', `CREATE INDEX IF NOT EXISTS "destinations_name_trgm" ON "Destinations" USING gin (name gin_trgm_ops)`],
  ];

  const [existing] = await sequelize.query(
    `SELECT indexname FROM pg_indexes WHERE tablename IN ('Ports','Destinations')`);
  const have = new Set(existing.map((r) => r.indexname));

  console.log('\ntrigram indexes for the pick-list search:');
  wanted.forEach(([name]) => console.log(`   ${have.has(name) ? 'already present' : 'WILL CREATE'}  ${name}`));

  if (COMMIT) {
    if (!ext.n) {
      await sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      console.log('   enabled pg_trgm');
    }
    for (const [name, sql] of wanted) {
      if (have.has(name)) continue;
      process.stdout.write(`   creating ${name} ... `);
      const t0 = Date.now();
      await sequelize.query(sql);
      console.log(`${Date.now() - t0} ms`);
    }
  }

  if (!COMMIT) {
    console.log('\nDry run finished - nothing written. Re-run with --commit to apply.');
    return;
  }

  await sequelize.query(`ANALYZE "Ports"`);
  await sequelize.query(`ANALYZE "Destinations"`);
  console.log('\nDone.');
}

main()
  .catch((err) => { console.error('Failed:', err); process.exitCode = 1; })
  .finally(async () => { await sequelize.close(); });
