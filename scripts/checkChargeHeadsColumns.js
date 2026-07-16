/*
 * Read-only diagnostic: prints the actual columns Postgres has for the
 * Charge_Heads table, so we can confirm whether SEJobId exists yet.
 *
 *   node scripts/checkChargeHeadsColumns.js
 */
const db = require('../models');
const { sequelize } = db;

async function main() {
    await sequelize.authenticate();
    // Wait for the alter-sync that fires on require('../models') to finish
    // settling (success or failure) before reading the schema or closing
    // the connection - otherwise this races the sync and can close the
    // pool out from under it.
    await db.syncPromise;
    const description = await sequelize.getQueryInterface().describeTable('Charge_Heads');
    console.log(description);
    await sequelize.close();
}

main().catch((err) => {
    console.error('Check failed:', err);
    process.exit(1);
});
