import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { BACKUP_HOST, databaseInventory, validateBackupCa, validateBackupTarget } from './productionBackupCore.js';
import { validateSnapshot } from './productionReconciliation.js';
import { createWriterPackage } from './reconciliationWriterPolicy.js';
import { DeploymentGateError, deploymentHash, inspectDeploymentSchema, requireDeploymentObservation,
  requireDeploymentBindings, requireDeploymentWindow, validateDeploymentEvidence } from './productionDeploymentGate.js';

export async function readGateDocument(path: string, privateFile: boolean): Promise<string> {
  const limit = privateFile ? 256 * 1024 : 2 * 1024 * 1024;
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit || info.nlink !== 1
      || privateFile && (info.uid !== process.getuid?.() || (info.mode & 0o777) !== 0o600)) {
      throw new DeploymentGateError('UNSAFE_DEPLOYMENT_GATE_FILE');
    }
    const raw = await handle.readFile('utf8');
    if (Buffer.byteLength(raw) > limit) throw new DeploymentGateError('DEPLOYMENT_GATE_FILE_TOO_LARGE');
    return raw;
  } finally { await handle.close(); }
}

/** Explicit, read-only adapter. No dotenv, Keychain, custody, login or server import. */
export async function runDeploymentGate(args: readonly string[]): Promise<void> {
  const [mode, ...rest] = args;
  const expected = ['--evidence', '--confirm-evidence', '--snapshot', '--release-sha', '--r2-account', '--r2-bucket', '--review-mode',
    ...(mode === 'inspect' ? ['--connection', '--window-start', '--window-end'] : [])];
  if (!['verify', 'inspect'].includes(mode) || rest.length !== expected.length * 2) throw new DeploymentGateError('EXPLICIT_DEPLOYMENT_GATE_MODE_REQUIRED');
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!expected.includes(rest[i]) || Object.hasOwn(flags, rest[i]) || !rest[i + 1]) throw new DeploymentGateError('INVALID_DEPLOYMENT_GATE_ARGUMENTS');
    flags[rest[i]] = rest[i + 1];
  }
  if (!expected.every(key => Object.hasOwn(flags, key))) throw new DeploymentGateError('MISSING_DEPLOYMENT_GATE_ARGUMENT');
  if (mode === 'inspect') requireDeploymentWindow(flags['--window-start'], flags['--window-end'], Date.now());
  const snapshotRaw = await readGateDocument(flags['--snapshot'], false);
  const snapshot: unknown = JSON.parse(snapshotRaw);
  validateSnapshot(snapshot);
  const bundle = createWriterPackage(snapshot);
  const raw = await readGateDocument(flags['--evidence'], true);
  const evidence = validateDeploymentEvidence(raw, { releaseSha: flags['--release-sha'], evidenceSha256: flags['--confirm-evidence'],
    snapshotSha256: deploymentHash(snapshotRaw), packageSha256: bundle.packageSha256, now: Date.now() });
  requireDeploymentBindings(evidence, flags['--r2-account'], flags['--r2-bucket'], flags['--review-mode']);
  if (mode === 'verify') {
    console.log(JSON.stringify({ status: 'RECONCILED_DEPLOYMENT_EVIDENCE_OFFLINE_VERIFIED', mode: evidence.mode,
      releaseSha: evidence.releaseSha, databaseAccessed: false, productionChanged: false, deploymentPerformed: false }));
    return;
  }
  // Separate private connection custody must be provisioned explicitly; never
  // silently take the application/development database URL from its environment.
  const connection: unknown = JSON.parse(await readGateDocument(flags['--connection'], true));
  if (!connection || typeof connection !== 'object' || Array.isArray(connection)) throw new DeploymentGateError('INVALID_GATE_CONNECTION');
  const config = connection as Record<string, unknown>;
  if (Object.keys(config).length !== 2 || typeof config.postgresUrl !== 'string' || typeof config.ca !== 'string') {
    throw new DeploymentGateError('INVALID_GATE_CONNECTION');
  }
  const target = validateBackupTarget(config.postgresUrl);
  validateBackupCa(config.ca);
  const client = new pg.Client({ host: BACKUP_HOST, port: 5432, database: 'postgres', user: target.user, password: target.password,
    ssl: { ca: config.ca, rejectUnauthorized: true, servername: BACKUP_HOST }, connectionTimeoutMillis: 12_000,
    query_timeout: 12_000, options: '-c default_transaction_read_only=on', application_name: 'sinegasi-deployment-schema-readonly' });
  client.on('error', () => {});
  try {
    requireDeploymentWindow(flags['--window-start'], flags['--window-end'], Date.now());
    await client.connect();
    const actual = await inspectDeploymentSchema({ query: (sql, values) => client.query(sql, values ? [...values] : undefined),
      inventory: () => databaseInventory(client) }, bundle,
    evidence.format === 3 ? evidence.studentPhotoChange : undefined);
    requireDeploymentObservation(actual, evidence.observation);
    // Recheck freshness/window after metadata reads, not only before connecting.
    requireDeploymentWindow(flags['--window-start'], flags['--window-end'], Date.now());
    validateDeploymentEvidence(raw, { releaseSha: evidence.releaseSha, evidenceSha256: flags['--confirm-evidence'],
      snapshotSha256: deploymentHash(snapshotRaw), packageSha256: bundle.packageSha256, now: Date.now() });
    console.log(JSON.stringify({ status: 'RECONCILED_DEPLOYMENT_SCHEMA_READONLY_VERIFIED', productionChanged: false,
      deploymentPerformed: false, businessAcceptancePerformed: false }));
  } finally { await client.end().catch(() => {}); }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  void runDeploymentGate(process.argv.slice(2)).catch(() => {
    // Raw PostgreSQL/file/JSON errors can contain secrets or schema bodies.
    console.error('DEPLOYMENT_GATE_REJECTED_NO_SQL_OR_DEPLOY_PERFORMED');
    process.exitCode = 1;
  });
}
