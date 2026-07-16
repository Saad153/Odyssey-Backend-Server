/*
 * Creates a timestamped pg_dump backup of the configured database, using
 * the same credentials the app itself uses from config/config.json.
 *
 * Requires the PostgreSQL client tools (pg_dump) to be installed and on
 * PATH.
 *
 *   node scripts/backupDb.js                  (backs up NODE_ENV || development)
 *
 * PowerShell, to back up production specifically:
 *   $env:NODE_ENV = "production"
 *   node scripts/backupDb.js
 *
 * Bash:
 *   NODE_ENV=production node scripts/backupDb.js
 *
 * Output: backups/<database>_<env>_<timestamp>.dump - a compressed,
 * custom-format dump restorable with pg_restore (supports selective /
 * parallel restore, unlike a plain .sql file).
 *
 * To verify a backup without restoring anything:
 *   pg_restore --list backups/<file>.dump
 *
 * To restore into a (new/empty) database:
 *   pg_restore -h <host> -p <port> -U <user> -d <target_db> --clean --if-exists backups/<file>.dump
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const env = process.env.NODE_ENV || 'development';
const config = require(path.join(__dirname, '..', 'config', 'config.json'))[env];

const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(backupsDir, `${config.database}_${env}_${timestamp}.dump`);

console.log(`Backing up database "${config.database}" (${env} config, ${config.host}:${config.port}) ...`);
console.log(`-> ${outFile}`);

const result = spawnSync('pg_dump', [
    '-h', config.host,
    '-p', String(config.port),
    '-U', config.username,
    '-F', 'c', // custom format: compressed, restorable selectively via pg_restore
    '-f', outFile,
    config.database,
], {
    env: { ...process.env, PGPASSWORD: config.password },
    stdio: 'inherit',
});

if (result.error) {
    if (result.error.code === 'ENOENT') {
        console.error('\npg_dump was not found on PATH. Install the PostgreSQL client tools (or add their "bin" folder to PATH) and try again.');
    } else {
        console.error('\nBackup failed:', result.error);
    }
    process.exit(1);
}

if (result.status !== 0) {
    console.error(`\npg_dump exited with code ${result.status}`);
    process.exit(result.status ?? 1);
}

const { size } = fs.statSync(outFile);
console.log(`\nBackup complete: ${outFile} (${(size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`Verify it with: pg_restore --list "${outFile}"`);
