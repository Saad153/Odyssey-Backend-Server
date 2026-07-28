/*
 * Retags a single Voucher/SE_Job/Invoice record to whichever fiscal year is
 * currently active. Needed for records created while the fiscal-year tag
 * hook still matched by date instead of always using the active year - such
 * a record could end up pointing at an unrelated, already-closed fiscal
 * year and get stuck locked by the update/destroy guard.
 *
 *   node scripts/retagToActiveFiscalYear.js SE_Job 123
 *   node scripts/retagToActiveFiscalYear.js Vouchers 456
 *   node scripts/retagToActiveFiscalYear.js Invoice 789
 */
const db = require('../models');
const { sequelize } = db;
const { FiscalYears } = require('../functions/Associations/fiscalYearAssociations');
const { Vouchers } = require('../functions/Associations/voucherAssociations');
const { SE_Job } = require('../functions/Associations/jobAssociations/seaExport');
const { Invoice } = require('../functions/Associations/incoiceAssociations');

const MODELS = { SE_Job, Vouchers, Invoice };

const [, , modelName, id] = process.argv;

async function main() {
    if (!MODELS[modelName] || !id) {
        console.error('Usage: node scripts/retagToActiveFiscalYear.js <SE_Job|Vouchers|Invoice> <id>');
        process.exit(1);
    }

    await sequelize.authenticate();

    const activeFiscalYear = await FiscalYears.findOne({ where: { isActive: true } });
    if (!activeFiscalYear) {
        console.error('No active fiscal year - activate one first.');
        process.exit(1);
    }

    const Model = MODELS[modelName];
    const record = await Model.findByPk(id);
    if (!record) {
        console.error(`${modelName} ${id} not found.`);
        process.exit(1);
    }

    console.log(`Current FiscalYearId: ${record.FiscalYearId}`);
    await record.update({ FiscalYearId: activeFiscalYear.id }, { fiscalYearCheck: false });
    console.log(`Retagged ${modelName} ${id} to active fiscal year "${activeFiscalYear.label}" (id ${activeFiscalYear.id}).`);

    await sequelize.close();
}

main().catch((err) => {
    console.error('Retag failed:', err);
    process.exit(1);
});
