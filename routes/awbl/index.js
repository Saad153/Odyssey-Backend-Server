const routes = require('express').Router();
const Sequelize = require('sequelize');
const { Awbl } = require("../../functions/Associations/awblAssociations");
const { Clients } = require("../../functions/Associations/clientAssociation");
const { SE_Job } = require("../../functions/Associations/jobAssociations/seaExport");
const { sequelize } = require("../../models");
const { createHistory } = require("../../functions/history");
const { parseEntry, generateSeries, formatNumber } = require("../../functions/awbl");
const Op = Sequelize.Op;

// AWB stock is held by the GROUP, not by a company. Airlines allocate numbers
// to Sea Net / Air Cargo jointly and either company can use any of them, so
// nothing here is scoped by company: one pool, one list, one set of unused
// numbers. An air waybill number is also unique worldwide, which the register
// mirrors - a number exists here exactly once.

const airlineInclude = {
  model: Clients,
  as: "Airline",
  attributes: ["id", "name", "code"],
  required: false,
};

// The consuming job, for the used rows. `required: false` so unused stock -
// which has no job at all - is never filtered out by the join.
//
// The nested Clients include has no `as`: SE_Job carries a dozen aliased party
// links (shipper, consignee, forwarder...), and the unaliased one is the job's
// own client, which is the party meant by "the party on that job".
const jobInclude = {
  model: SE_Job,
  attributes: ["id", "jobNo", "companyId"],
  required: false,
  include: [{ model: Clients, attributes: ["name"], required: false }],
};

/* -------------------------------------------------------------------------
 * REGISTER  - one number, or a generated series starting at that number.
 * ---------------------------------------------------------------------- */
routes.post("/register", async (req, res) => {
  try {
    const { airlineId, prefix, code, series, count, employeeId } = req.body;

    if (!airlineId) {
      return res.json({ status: "error", result: "Select the airline this AWB belongs to." });
    }

    const parsed = parseEntry(prefix, code);
    if (!parsed.ok) {
      return res.json({ status: "error", result: parsed.error });
    }

    const howMany = series ? Math.floor(Number(count) || 0) : 1;
    if (series && (howMany < 1 || howMany > 1000)) {
      return res.json({
        status: "error",
        result: "Enter how many to generate, between 1 and 1000.",
      });
    }

    const candidates = generateSeries(parsed.prefix, parsed.serial, howMany);
    if (!candidates.length) {
      return res.json({ status: "error", result: "That serial is past the highest 7-digit number." });
    }

    // Numbers already in the register are skipped rather than failing the whole
    // batch - re-running a series to fill a gap is normal, and one clash should
    // not lose the other 99 numbers.
    const existing = await Awbl.findAll({
      where: { awbNumber: { [Op.in]: candidates.map((x) => x.awbNumber) } },
      attributes: ["awbNumber"],
    });
    const alreadyHave = new Set(existing.map((x) => x.awbNumber));
    const fresh = candidates.filter((x) => !alreadyHave.has(x.awbNumber));

    if (!fresh.length) {
      return res.json({
        status: "error",
        result:
          candidates.length === 1
            ? `${formatNumber(candidates[0].awbNumber)} is already registered.`
            : "Every number in that series is already registered.",
      });
    }

    const created = await Awbl.bulkCreate(
      fresh.map((x) => ({
        ...x,
        AirlineId: airlineId,
        status: "unused",
        createdById: employeeId ? String(employeeId) : null,
      }))
    );

    createHistory(
      employeeId,
      'AWBL',
      'Create',
      created.length === 1
        ? formatNumber(created[0].awbNumber)
        : `${created.length} numbers from ${formatNumber(fresh[0].awbNumber)}`
    );

    return res.json({
      status: "success",
      result: {
        created: created.length,
        skipped: candidates.length - fresh.length,
        from: formatNumber(fresh[0].awbNumber),
        to: formatNumber(fresh[fresh.length - 1].awbNumber),
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({ status: "error", result: error.message || String(error) });
  }
});

/* -------------------------------------------------------------------------
 * LIST - server-side paginated / searchable, for the Setup page.
 * ---------------------------------------------------------------------- */
routes.get("/list", async (req, res) => {
  try {
    // `all=1` returns the whole filtered set in one go, for the print view -
    // printing only the 20 rows that happen to be on screen would be useless.
    // Still capped, so a stray call can never try to serialise the entire
    // register in one response.
    const wantsAll = req.query.all === '1' || req.query.all === 'true';
    const page = wantsAll ? 1 : Math.max(parseInt(req.query.page) || 1, 1);
    const limit = wantsAll
      ? 20000
      : Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 200);

    const search = String(req.query.search || "").trim().replace(/[\s-]/g, '');
    const airlineId = req.query.airlineId;
    const status = req.query.status; // all | used | unused

    const where = {};

    if (status === "used" || status === "unused") {
      where.status = status;
    }
    if (airlineId) {
      where.AirlineId = airlineId;
    }
    if (search) {
      // Matching on the stripped 11-digit column means the user can type the
      // number with or without the usual 125-1234567 8 spacing.
      where.awbNumber = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows } = await Awbl.findAndCountAll({
      where,
      include: [airlineInclude, jobInclude],
      order: [["prefix", "ASC"], ["serial", "ASC"]],
      limit,
      offset: (page - 1) * limit,
      // findAndCountAll counts rows of the joined result by default, which the
      // nested party include would inflate. The job side is one-to-one, so
      // counting distinct parents keeps the pager honest.
      distinct: true,
    });

    return res.json({
      status: "success",
      result: {
        rows: rows.map((row) => ({
          id: row.id,
          awbNumber: row.awbNumber,
          formatted: formatNumber(row.awbNumber),
          prefix: row.prefix,
          serial: row.serial,
          checkDigit: row.checkDigit,
          status: row.status,
          usedAt: row.usedAt,
          SEJobId: row.SEJobId,
          // Job number and party, rather than the raw id - the id means
          // nothing to anyone reading the list or a printout. The job also
          // carries which company consumed the number, which is the only place
          // company matters now that the stock itself is group-wide.
          jobNo: row.SE_Job ? row.SE_Job.jobNo : "",
          party: row.SE_Job && row.SE_Job.Client ? row.SE_Job.Client.name : "",
          airline: row.Airline ? `${row.Airline.name} (${row.Airline.code})` : "",
        })),
        count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return res.json({ status: "error", result: error.message || String(error) });
  }
});

/* -------------------------------------------------------------------------
 * AVAILABLE - unused numbers for the job's airline, for the BL dropdown.
 * ---------------------------------------------------------------------- */
routes.get("/available", async (req, res) => {
  try {
    const { airlineId, jobId } = req.query;

    // The number already on this job is included alongside the unused ones.
    // Without that it would vanish from its own dropdown the moment it was
    // saved (it is 'used' by then), and re-saving the BL would blank it.
    const where = {
      [Op.or]: [
        { status: "unused", ...(airlineId ? { AirlineId: airlineId } : {}) },
        ...(jobId ? [{ SEJobId: jobId }] : []),
      ],
    };

    const rows = await Awbl.findAll({
      where,
      include: [airlineInclude],
      order: [["prefix", "ASC"], ["serial", "ASC"]],
      limit: 500,
    });

    return res.json({
      status: "success",
      result: rows.map((row) => ({
        id: row.id,
        // `name` / `id` is the shape SelectSearchComp expects.
        name: formatNumber(row.awbNumber),
        awbNumber: row.awbNumber,
        status: row.status,
        SEJobId: row.SEJobId,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.json({ status: "error", result: error.message || String(error) });
  }
});

/* -------------------------------------------------------------------------
 * ASSIGN - attach a number to a job, releasing whatever that job held before.
 * ---------------------------------------------------------------------- */
routes.post("/assign", async (req, res) => {
  const t = await sequelize.transaction();
  let committed = false;

  try {
    const { awblId, jobId, employeeId } = req.body;

    if (!jobId) {
      await t.rollback();
      return res.json({ status: "error", result: "Job is required." });
    }

    // Free the number this job was previously holding. Doing it first means
    // swapping A for B never leaves both marked used.
    await Awbl.update(
      { status: "unused", SEJobId: null, usedAt: null },
      { where: { SEJobId: jobId, ...(awblId ? { id: { [Op.ne]: awblId } } : {}) }, transaction: t }
    );

    if (!awblId) {
      await t.commit();
      committed = true;
      return res.json({ status: "success", result: { cleared: true } });
    }

    // Conditional update: only claim the row if it is still free (or already
    // this job's). Two users saving different jobs at the same moment cannot
    // therefore both take it - the loser updates 0 rows and is told so.
    const [claimed] = await Awbl.update(
      { status: "used", SEJobId: jobId, usedAt: new Date().toISOString() },
      {
        where: {
          id: awblId,
          [Op.or]: [{ status: "unused" }, { SEJobId: jobId }],
        },
        transaction: t,
      }
    );

    if (!claimed) {
      await t.rollback();
      return res.json({
        status: "error",
        result: "That AWB has just been taken by another job. Pick a different number.",
      });
    }

    const row = await Awbl.findOne({ where: { id: awblId }, transaction: t });

    await t.commit();
    committed = true;

    createHistory(employeeId, 'AWBL', 'Assign', formatNumber(row.awbNumber));

    return res.json({
      status: "success",
      result: { id: row.id, awbNumber: row.awbNumber, formatted: formatNumber(row.awbNumber) },
    });
  } catch (error) {
    if (!committed) await t.rollback().catch(() => {});
    console.error(error);
    return res.json({ status: "error", result: error.message || String(error) });
  }
});

/* -------------------------------------------------------------------------
 * RELEASE - free every number held by a job (used when a job is deleted).
 * ---------------------------------------------------------------------- */
routes.post("/release", async (req, res) => {
  try {
    const { jobId, awblId, employeeId } = req.body;

    if (!jobId && !awblId) {
      return res.json({ status: "error", result: "Job or AWB is required." });
    }

    const released = await Awbl.update(
      { status: "unused", SEJobId: null, usedAt: null },
      { where: awblId ? { id: awblId } : { SEJobId: jobId } }
    );

    createHistory(employeeId, 'AWBL', 'Release', String(awblId || jobId));
    return res.json({ status: "success", result: { released: released[0] } });
  } catch (error) {
    console.error(error);
    return res.json({ status: "error", result: error.message || String(error) });
  }
});

/* -------------------------------------------------------------------------
 * DELETE - remove unused stock only (mis-keyed prefix, wrong series length).
 * ---------------------------------------------------------------------- */
routes.post("/delete", async (req, res) => {
  try {
    const { id, employeeId } = req.body;

    if (!id) {
      return res.json({ status: "error", result: "AWB is required." });
    }

    const row = await Awbl.findOne({ where: { id } });
    if (!row) {
      return res.json({ status: "error", result: "That AWB no longer exists." });
    }
    if (row.status === "used") {
      return res.json({
        status: "error",
        result: `${formatNumber(row.awbNumber)} is in use on a job. Remove it from the job first.`,
      });
    }

    await row.destroy();
    createHistory(employeeId, 'AWBL', 'Delete', formatNumber(row.awbNumber));
    return res.json({ status: "success", result: { id } });
  } catch (error) {
    console.error(error);
    return res.json({ status: "error", result: error.message || String(error) });
  }
});

module.exports = routes;
