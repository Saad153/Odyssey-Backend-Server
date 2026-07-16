/*
 * Loads every functions/Associations/* file (same ones index.js loads),
 * which is what actually attaches foreign key attributes like SEJobId,
 * InvoiceId, CompanyId, etc. to their models in memory. Without loading
 * these, a model's rawAttributes only reflects its own explicitly declared
 * fields - not the association-derived foreign keys - which is why
 * scripts/diagnoseSyncGaps.js reported nothing missing while the real
 * server still failed.
 *
 * Then, for every model, compares attributes against the live DB and adds
 * any missing column directly via ADD COLUMN - always as nullable,
 * regardless of what the model declares, since sequelize.sync({alter:true})
 * dies the instant it tries to add a NOT NULL column to a table that
 * already has rows with no value to backfill. That's the root cause behind
 * every one of these failures so far (Charge_Heads.SEJobId, Vouchers.CompanyId).
 *
 * This bypasses sequelize.sync() entirely for these additions, so one
 * blocked table can no longer prevent every other table from being fixed.
 *
 *   node scripts/fixAssociationColumns.js
 *
 * Safe to re-run - already-existing columns are left untouched.
 */
const db = require('../models');
const { sequelize, Sequelize } = db;

// Same list index.js loads, in the same order.
require('../functions/Associations/jobAssociations/seaExport');
require('../functions/Associations/clientAssociation');
require('../functions/Associations/voucherAssociations');
require('../functions/Associations/incoiceAssociations');
require('../functions/Associations/NotificationAssociation');
require('../functions/Associations/taskAssociation');
require('../functions/Associations/vesselAssociations');

const SKIP_KEYS = new Set(['sequelize', 'Sequelize', 'syncPromise']);

async function main() {
    await sequelize.authenticate();
    await db.syncPromise;

    const qi = sequelize.getQueryInterface();
    const added = [];
    const skippedExisting = [];
    const failed = [];

    for (const key of Object.keys(db)) {
        if (SKIP_KEYS.has(key)) continue;
        const model = db[key];
        if (!model || typeof model.getTableName !== 'function') continue;

        const tableName = model.getTableName();
        let liveColumns;
        try {
            liveColumns = await qi.describeTable(tableName);
        } catch (err) {
            continue; // table itself doesn't exist yet - sync() handles plain CREATE TABLE fine, not our concern here
        }

        for (const [attrName, attr] of Object.entries(model.rawAttributes)) {
            const columnName = attr.field || attrName;
            if (liveColumns[columnName]) {
                continue;
            }
            try {
                await qi.addColumn(tableName, columnName, {
                    type: attr.type,
                    allowNull: true, // always nullable - existing rows can't be backfilled blindly
                });
                added.push(`${tableName}.${columnName}`);
            } catch (err) {
                failed.push({ table: tableName, column: columnName, error: err.message });
            }
        }
    }

    console.log('Added columns:', added);
    if (skippedExisting.length) console.log('Already present:', skippedExisting);
    if (failed.length) {
        console.log('Failed to add:');
        console.table(failed);
    }

    await sequelize.close();
}

main().catch((err) => {
    console.error('Fix failed:', err);
    process.exit(1);
});
