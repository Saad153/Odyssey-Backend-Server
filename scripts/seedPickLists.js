/*
 * One-time data migration: loads the static picklist JSON files that used to
 * ship with the frontend (ports.json, destinations.json, airports.json) into
 * their new DB tables (Ports, Destinations, Airports).
 *
 * Run this yourself from the Odyssey-Backend-Server folder, once, after the
 * server has started at least one time (so sequelize.sync has created the
 * new tables):
 *
 *   node scripts/seedPickLists.js
 *
 * Safe to re-run, and safe even if some ports/destinations/airports were
 * already added by hand before this migration (e.g. via the old "Add Port"
 * flow): only rows that aren't already present get inserted, nothing is
 * skipped just because the table isn't empty.
 */
const path = require('path');
const fs = require('fs');
const db = require('../models');
const { sequelize, Ports, Destinations, Airports } = db;

const FRONTEND_JSON_DIR = path.join(__dirname, '..', '..', 'Odyssey-Front-end', 'jsonData');
const BATCH_SIZE = 5000;

function loadJson(fileName) {
    const filePath = path.join(FRONTEND_JSON_DIR, fileName);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Could not find ${filePath}. Adjust FRONTEND_JSON_DIR if your folder layout differs.`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function bulkInsertInBatches(model, rows) {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        await model.bulkCreate(batch, { ignoreDuplicates: true });
        inserted += batch.length;
        process.stdout.write(`\r${model.name}: ${Math.min(inserted, rows.length)}/${rows.length}`);
    }
    process.stdout.write('\n');
}

async function seedPorts() {
    // Ports has no unique constraint (the source data legitimately repeats
    // codes for different places), so `ignoreDuplicates` can't dedupe at the
    // DB level here. Dedupe against what's already stored by portId+portName
    // instead, so pre-existing manually-added ports don't cause the whole
    // base list to be skipped.
    const existingRows = await Ports.findAll({ attributes: ['portId', 'portName'], raw: true });
    const existingKeys = new Set(existingRows.map((r) => `${r.portId}|||${r.portName}`));

    const { ports } = loadJson('ports.json');
    const rows = ports
        .map((p) => ({ portId: p.id, portName: p.name, portCountry: p.country }))
        .filter((p) => !existingKeys.has(`${p.portId}|||${p.portName}`));

    if (rows.length === 0) {
        console.log('Ports: nothing new to insert.');
        return;
    }
    await bulkInsertInBatches(Ports, rows);
}

async function seedDestinations() {
    const destinations = loadJson('destinations.json');
    const seen = new Set();
    const rows = [];
    for (const d of destinations) {
        if (seen.has(d.name)) continue;
        seen.add(d.name);
        rows.push({ name: d.name });
    }
    // Destinations.name is unique, so ignoreDuplicates safely no-ops on
    // anything already in the table.
    await bulkInsertInBatches(Destinations, rows);
}

async function seedAirports() {
    const airports = loadJson('airports.json');
    const rows = airports.map((a) => ({
        airportCode: a.id,
        airportName: a.airport,
        city: a.city,
        country: a.country,
    }));
    // Airports.airportCode is unique, so ignoreDuplicates safely no-ops on
    // anything already in the table.
    await bulkInsertInBatches(Airports, rows);
}

async function main() {
    await sequelize.authenticate();
    // Wait for the alter-sync that fires on require('../models') to finish
    // settling before touching any tables - otherwise this can race ahead
    // of table creation (or close the connection out from under it).
    await db.syncPromise;

    // Run each resource independently so a failure in one (e.g. Ports, which
    // does the heaviest work) doesn't silently prevent the others from ever
    // running.
    const steps = [
        ['Ports', seedPorts],
        ['Destinations', seedDestinations],
        ['Airports', seedAirports],
    ];
    const failures = [];
    for (const [name, fn] of steps) {
        try {
            await fn();
        } catch (err) {
            console.error(`${name} seeding failed:`, err);
            failures.push(name);
        }
    }

    await sequelize.close();
    if (failures.length) {
        console.error(`Done with errors in: ${failures.join(', ')}`);
        process.exit(1);
    }
    console.log('Done.');
}

main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
