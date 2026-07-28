/*
 * Read-only diagnostic: dumps the most recently created SE_Jobs with their
 * FiscalYearId, jobDate, and createdAt, to trace why a job's stored
 * FiscalYearId doesn't match whichever fiscal year is currently active.
 *
 *   node scripts/inspectRecentJobs.js
 *   node scripts/inspectRecentJobs.js 10
 */
const db = require('../models');
const { sequelize } = db;
const { SE_Job } = require('../functions/Associations/jobAssociations/seaExport');
const { FiscalYears } = require('../functions/Associations/fiscalYearAssociations');

const limit = parseInt(process.argv[2], 10) || 5;

async function main() {
    await sequelize.authenticate();

    const jobs = await SE_Job.findAll({
        order: [['createdAt', 'DESC']],
        limit,
        attributes: ['id', 'jobNo', 'jobDate', 'createdAt', 'updatedAt', 'FiscalYearId'],
    });

    const fiscalYears = await FiscalYears.findAll({ attributes: ['id', 'label', 'isActive'] });
    const fyMap = Object.fromEntries(fiscalYears.map((f) => [f.id, `${f.label}${f.isActive ? ' (active)' : ''}`]));

    console.table(
        jobs.map((j) => ({
            id: j.id,
            jobNo: j.jobNo,
            jobDate: j.jobDate,
            createdAt: j.createdAt,
            FiscalYearId: j.FiscalYearId,
            fiscalYear: fyMap[j.FiscalYearId] || '(none/unmatched)',
        }))
    );

    await sequelize.close();
}

main().catch((err) => {
    console.error('Inspect failed:', err);
    process.exit(1);
});
