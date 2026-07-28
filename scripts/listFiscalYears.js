/*
 * Read-only diagnostic: lists every fiscal year row and its isActive flag,
 * to check whether more than one is (incorrectly) marked active at once -
 * FiscalYears.findOne({where:{isActive:true}}) has no ORDER BY, so if two
 * rows are both active, which one gets used is whatever Postgres happens
 * to return first, not necessarily the one you most recently activated.
 *
 *   node scripts/listFiscalYears.js
 */
const db = require('../models');
const { sequelize } = db;
const { FiscalYears } = require('../functions/Associations/fiscalYearAssociations');

async function main() {
    await sequelize.authenticate();

    const all = await FiscalYears.findAll({ order: [['startDate', 'ASC']] });

    console.table(
        all.map((x) => ({
            id: x.id,
            label: x.label,
            suffix: x.suffix,
            startDate: x.startDate,
            endDate: x.endDate,
            isActive: x.isActive,
        }))
    );

    const activeOnes = all.filter((x) => x.isActive);
    console.log(`\n${activeOnes.length} row(s) marked isActive:true`);
    if (activeOnes.length > 1) {
        console.log('^ THIS IS THE BUG - more than one fiscal year is active at once.');
        console.log('Active ids:', activeOnes.map((x) => x.id).join(', '));
    }

    await sequelize.close();
}

main().catch((err) => {
    console.error('List failed:', err);
    process.exit(1);
});
