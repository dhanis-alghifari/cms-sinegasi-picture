import { constants } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { BACKUP_HOST, BackupError, databaseInventory, readKeychain, validateBackupCa, validateBackupTarget } from './productionBackupCore.js';
import { loadPreflightPlan, ReconciliationPreflightError, requirePreflightMode, requireReadOnlyProductionIdentity, validateLegacyInventory } from './productionReconciliationPreflightCore.js';

// Intentionally NO apply mode and NO import of app config / dotenv.
async function main(): Promise<void> {
  const mode = requirePreflightMode(process.argv.slice(2));
  const repository = resolve(__dirname, '../../..');
  const { plan, snapshot } = await loadPreflightPlan(repository);
  if (mode === 'plan') { console.log(JSON.stringify(plan)); return; }
  if (process.platform !== 'darwin') throw new ReconciliationPreflightError('READONLY_PREFLIGHT_REQUIRES_MAC');
  process.umask(0o077);
  const caPath = '/Users/memberid/Downloads/prod-ca-2021.crt';
  const caInfo = await lstat(caPath);
  if (!caInfo.isFile() || caInfo.isSymbolicLink() || caInfo.size > 32768) throw new ReconciliationPreflightError('UNSAFE_CA_FILE');
  const ca = await readFile(caPath, 'utf8');
  validateBackupCa(ca);
  console.log(JSON.stringify({ stage: 'KEYCHAIN_ADMIN_READ_REQUIRED', readOnly: true, productionChanged: false }));
  let raw = await readKeychain('sinegasi-prod-postgres-admin-url', 'postgres');
  const target = validateBackupTarget(raw); raw = '';
  const db = new pg.Client({
    host: BACKUP_HOST, port: 5432, database: 'postgres', user: target.user, password: target.password,
    ssl: { ca, rejectUnauthorized: true, servername: BACKUP_HOST },
    connectionTimeoutMillis: 12000, query_timeout: 10000,
    application_name: 'sinegasi-reconciliation-readonly-preflight',
    options: '-c default_transaction_read_only=on',
  });
  db.on('error', () => {});
  let transaction = false;
  try {
    await db.connect(); target.password = '';
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); transaction = true;
    await db.query("SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='2s'; SET LOCAL search_path=pg_catalog,public,extensions");
    const identity = (await db.query(`SELECT current_database() AS database,current_user AS actor,
      current_setting('transaction_read_only') AS "readOnly",current_setting('server_version') AS version`)).rows[0] as unknown;
    const version = requireReadOnlyProductionIdentity(identity);
    const history = (await db.query(`SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='sinegasi_ops') AS exists`)).rows[0] as { exists: unknown };
    if (history.exists !== false) throw new ReconciliationPreflightError('EXISTING_OPERATIONS_SCHEMA_REQUIRES_REVIEW');
    const inventory = await databaseInventory(db);
    const observed = validateLegacyInventory(inventory, snapshot);
    await db.query('ROLLBACK'); transaction = false;
    const report = {
      ...plan, status: 'PRODUCTION_LEGACY_READONLY_PREFLIGHT_PASSED', verifiedAt: new Date().toISOString(),
      ...observed, sourceVersion: version, readOnly: true, legacyTableAndColumnBaselineMatched: true,
      fullLegacyCatalogComparedToBackup: false, fullManagedSchemasVerified: false,
      readyToApply: false, observationOnly: true,
    };
    const ops = resolve(repository, 'ops');
    const opsInfo = await lstat(ops);
    if (!opsInfo.isDirectory() || opsInfo.isSymbolicLink() || opsInfo.uid !== process.getuid?.()) throw new ReconciliationPreflightError('UNSAFE_REPORT_DIRECTORY');
    const path = resolve(ops, `production-reconciliation.preflight.${report.verifiedAt.replace(/[:.]/g, '-')}.json`);
    const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(JSON.stringify(report, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
    console.log(JSON.stringify({ ...report, report: path }));
  } finally {
    target.password = '';
    if (transaction) await db.query('ROLLBACK').catch(() => {});
    await db.end().catch(() => {});
  }
}
void main().catch((error: unknown) => {
  const stage = error instanceof ReconciliationPreflightError || error instanceof BackupError ? error.stage : 'READONLY_PREFLIGHT_FAILED';
  // Never print raw SQL/server/Keychain errors, connection strings or catalog bodies.
  console.error(JSON.stringify({ status: 'STOP', stage, productionChanged: false }));
  process.exitCode = 1;
});
