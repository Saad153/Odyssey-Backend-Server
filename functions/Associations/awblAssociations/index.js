const { Op } = require("sequelize");
const { Awbl, Clients, SE_Job } = require("../../../models");

// The airline that issued the stock. Airlines are ordinary parties whose
// `types` string contains 'Air Line' (same source the job's airLineId picker
// uses - see routes/jobRoutes/sea.js getValues).
Clients.hasMany(Awbl, { foreignKey: "AirlineId" });
Awbl.belongsTo(Clients, { as: "Airline", foreignKey: "AirlineId" });

// A used number points at the one job consuming it. hasMany rather than
// hasOne only because Sequelize's hasOne would still allow a second row to
// claim the same job; the "one job per number" direction is what matters and
// that is enforced by SEJobId living on this side.
SE_Job.hasMany(Awbl);
Awbl.belongsTo(SE_Job);

/* -------------------------------------------------------------------------
 * Deleting a job returns its AWB to the unused pool.
 *
 * This lives on the model rather than inside routes/jobRoutes/sea.js
 * deleteJob for the same reason the fiscal-year gates do (see
 * functions/Associations/fiscalYearAssociations): one choke point that every
 * path removing a job goes through automatically - that route, any future
 * one, a maintenance script - so a number can never be stranded as 'used'
 * against a job that no longer exists.
 *
 * Split across before/after on purpose:
 *
 *  - The ids have to be READ before the delete. SEJobId is a nullable foreign
 *    key, so Sequelize's default ON DELETE SET NULL clears the link as the job
 *    goes; by the time an after-hook runs there is nothing left to match on.
 *
 *  - The release itself has to happen AFTER the delete succeeds, and is keyed
 *    on the AWB's own primary key rather than SEJobId (which the cascade may
 *    already have nulled). Freeing in a before-hook would hand the number back
 *    to the pool even when the delete then failed - including when the
 *    fiscal-year gate rejects it, which is a routine outcome, not a rare one.
 * ---------------------------------------------------------------------- */

// Ids of the AWBs held by the jobs about to be deleted, stashed on the call's
// options so the matching after-hook can act on them.
const STASH = "__awblIdsToRelease";

const findHeldAwblIds = async (jobIds, transaction) => {
  const ids = [...new Set(jobIds)].filter((id) => id !== null && id !== undefined);
  if (!ids.length) return [];
  const held = await Awbl.findAll({
    where: { SEJobId: { [Op.in]: ids } },
    attributes: ["id"],
    transaction,
  });
  return held.map((row) => row.id);
};

// Adds to the stash rather than replacing it: passing individualHooks:true to
// a bulk destroy makes Sequelize run the per-row hooks as well as the bulk
// ones against the same options object, and a plain assignment there would
// drop whichever set was recorded first.
const stashAwblIds = (options, ids) => {
  options[STASH] = [...new Set([...(options[STASH] || []), ...ids])];
};

const releaseAwblIds = async (awblIds, transaction) => {
  if (!awblIds || !awblIds.length) return;
  await Awbl.update(
    { status: "unused", SEJobId: null, usedAt: null },
    { where: { id: { [Op.in]: awblIds } }, transaction }
  );
};

// Instance path: job.destroy()
SE_Job.addHook("beforeDestroy", async (instance, options) => {
  stashAwblIds(options, await findHeldAwblIds([instance.id], options.transaction));
});

SE_Job.addHook("afterDestroy", async (instance, options) => {
  await releaseAwblIds(options[STASH], options.transaction);
});

// Static path: SE_Job.destroy({ where }) - what routes/jobRoutes/sea.js
// deleteJob actually calls.
SE_Job.addHook("beforeBulkDestroy", async (options) => {
  const doomed = await SE_Job.findAll({
    where: options.where,
    attributes: ["id"],
    transaction: options.transaction,
  });
  stashAwblIds(options, await findHeldAwblIds(doomed.map((row) => row.id), options.transaction));
});

SE_Job.addHook("afterBulkDestroy", async (options) => {
  await releaseAwblIds(options[STASH], options.transaction);
});

module.exports = { Awbl };
