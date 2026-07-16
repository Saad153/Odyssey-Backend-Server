/*
 * Read-only diagnostic: compares every model's defined attributes against
 * the live DB schema, so we can see every column sequelize.sync({alter:true})
 * still needs to add - without having to discover them one restart at a
 * time (sync() aborts entirely on the first NOT NULL column it can't add
 * to a table that already has rows, so anything after that point in the
 * loop never gets checked).
 *
 *   node scripts/diagnoseSyncGaps.js
 */
const db = require('../models');
const { sequelize } = db;

const SKIP_KEYS = new Set(['sequelize', 'Sequelize', 'syncPromise']);

async function main() {
    await sequelize.authenticate();
    await db.syncPromise;

    const qi = sequelize.getQueryInterface();
    const missing = [];
    const errors = [];

    for (const key of Object.keys(db)) {
        if (SKIP_KEYS.has(key)) continue;
        const model = db[key];
        if (!model || typeof model.getTableName !== 'function') continue;

        const tableName = model.getTableName();
        let liveColumns;
        try {
            liveColumns = await qi.describeTable(tableName);
        } catch (err) {
            errors.push({ model: key, table: tableName, error: err.message });
            continue;
        }

        let rowCount = null;
        const attrs = model.rawAttributes;
        for (const attrName of Object.keys(attrs)) {
            const attr = attrs[attrName];
            const columnName = attr.field || attrName;
            if (liveColumns[columnName]) continue; // already exists, fine

            if (rowCount === null) {
                rowCount = await model.count().catch(() => null);
            }

            missing.push({
                model: key,
                table: tableName,
                column: columnName,
                allowNull: attr.allowNull !== false,
                existingRows: rowCount,
                blocker: attr.allowNull === false && rowCount > 0,
            });
        }
    }

    console.log('--- Missing columns (not yet in the DB) ---');
    console.table(missing);
    if (errors.length) {
        console.log('--- Tables that could not be described ---');
        console.table(errors);
    }

    await sequelize.close();
}

main().catch((err) => {
    console.error('Diagnosis failed:', err);
    process.exit(1);
});
