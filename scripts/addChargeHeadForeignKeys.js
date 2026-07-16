/*
 * One-off migration: adds the SEJobId and InvoiceId foreign key columns to
 * Charge_Heads. These are defined via association calls in
 * functions/Associations/incoiceAssociations/index.js (SE_Job.hasMany /
 * Invoice.hasMany), but sequelize.sync({alter:true}) isn't materializing
 * them on the existing table - a known Sequelize limitation for foreign
 * keys introduced only through associations, especially on a table that
 * already has rows.
 *
 * Added as nullable: the table already has existing Charge_Head rows with
 * no historical job/invoice link to backfill, so a NOT NULL column can't
 * be added without a default. New rows created via the app already pass
 * SEJobId (and, where applicable, an invoice link) on create, so they'll
 * populate correctly going forward; only pre-existing rows will have NULL.
 *
 *   node scripts/addChargeHeadForeignKeys.js
 */
const db = require('../models');
const { sequelize, Sequelize } = db;

async function addColumnIfMissing(table, column, spec) {
    const existing = await sequelize.getQueryInterface().describeTable(table);
    if (existing[column]) {
        console.log(`${table}.${column} already exists, skipping.`);
        return;
    }
    await sequelize.getQueryInterface().addColumn(table, column, spec);
    console.log(`Added ${table}.${column}.`);
}

async function main() {
    await sequelize.authenticate();
    await db.syncPromise;

    await addColumnIfMissing('Charge_Heads', 'SEJobId', {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'SE_Jobs', key: 'id' },
    });
    await addColumnIfMissing('Charge_Heads', 'InvoiceId', {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Invoices', key: 'id' },
    });

    console.log('Done.');
    await sequelize.close();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
