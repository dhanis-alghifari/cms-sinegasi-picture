import { quoteIdentifier } from './productionBackupCore.js';
import type { DatabaseInventory } from './productionBackupCore.js';
import { splitSqlStatements, transactionalSql } from './migrationSafety.js';
import { insertReferenceRows } from './productionReferenceData.js';
import { sha256 } from './productionReconciliation.js';
import { validateLegacyInventory } from './productionReconciliationPreflightCore.js';
import { readWriterCatalog, verifyWriterTarget, writerCatalogHash, type WriterSession } from './reconciliationWriterCatalog.js';
import { createWriterPackage, object, requireWriterWindow, validateWriterApproval, validateWriterEvidence, validateWriterRecovery,
  WriterError, type WriterPackage } from './reconciliationWriterPolicy.js';

const HISTORY = 'sinegasi_ops.production_reconciliation_runs';
const LOCK = "SELECT pg_try_advisory_lock(hashtext('sinegasi:schema-migrations')) AS acquired";
export interface WriterAuthorization {
  releaseSha: string;
  approvalRaw: string;
  confirmedApprovalSha256: string;
  evidenceRaw: string;
  recoveryRaw: string;
  backupInventory: DatabaseInventory;
}
interface Run {
  package_sha256: string; approval_sha256: string; release_sha: string; backup_inventory_sha256: string;
  stage: 'enums' | 'complete'; enums_catalog_sha256: string; target_catalog_sha256: string | null;
}

/** Single connected session, no pool/implicit reconnect. Production connections
 * are constructed only by the Mac CLI; tests supply network-none disposable PG.
 */
export async function runReconciliationWriter(
  db: WriterSession, bundle: WriterPackage, auth: WriterAuthorization, now: () => number = Date.now,
): Promise<{ mode: 'applied' | 'resumed' | 'noop'; packageSha256: string; mutation: 'complete' | 'none'; managedAcceptanceRequired: true }> {
  // Validate everything before even sending a query (including trusted generated SQL).
  const generated = createWriterPackage(bundle.snapshot);
  if (JSON.stringify(generated) !== JSON.stringify(bundle)) throw new WriterError('WRITER_PACKAGE_TAMPERED');
  const approvalSha256 = sha256(auth.approvalRaw);
  if (approvalSha256 !== auth.confirmedApprovalSha256) throw new WriterError('APPROVAL_CHECKSUM_MISMATCH');
  const approval = validateWriterApproval(JSON.parse(auth.approvalRaw) as unknown, bundle, auth.releaseSha, sha256(auth.evidenceRaw), now());
  validateWriterEvidence(JSON.parse(auth.evidenceRaw) as unknown, bundle);
  if (sha256(auth.recoveryRaw) !== approval.recoveryEvidenceSha256) throw new WriterError('RECOVERY_EVIDENCE_CHECKSUM_MISMATCH');
  validateWriterRecovery(JSON.parse(auth.recoveryRaw) as unknown, approval, now());
  validateLegacyInventory(auth.backupInventory, bundle.snapshot);
  const backupHash = sha256(JSON.stringify(auth.backupInventory));
  let transaction = false, lock = false, committing = false;
  let mutation: 'none' | 'enums' | 'complete' | 'unknown' = 'none';
  let pid: unknown;
  const identity = async () => {
    const info = (await db.query(`SELECT current_database() AS database,current_user AS actor,pg_backend_pid() AS pid,
      current_setting('server_version_num') AS version,current_setting('transaction_read_only') AS "readOnly"`)).rows[0];
    if (!info || info.database !== 'postgres' || info.actor !== 'postgres' || !/^17[0-9]{4}$/.test(String(info.version))
      || info.readOnly !== 'off' || !Number.isInteger(info.pid) || (pid !== undefined && pid !== info.pid)) {
      throw new WriterError('WRITER_PRODUCTION_SESSION_IDENTITY_REQUIRED');
    }
    pid = info.pid;
  };
  const begin = async () => {
    requireWriterWindow(approval, now());
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ'); transaction = true;
    await db.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='25s'; SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL search_path=pg_catalog,public,extensions");
    await identity();
  };
  const commit = async () => {
    requireWriterWindow(approval, now());
    committing = true;
    await db.query('COMMIT'); transaction = false; committing = false;
  };
  const execute = async (sql: string) => {
    for (const statement of splitSqlStatements(transactionalSql(sql))) await db.query(statement);
  };
  const lockPublic = async () => {
    const names = (await db.inventory()).tables.map(t => t.name).sort();
    if (names.some(name => !bundle.snapshot.tables.some(t => t.relname === name))) throw new WriterError('WRITER_UNKNOWN_TABLE_REFUSED');
    if (names.length) await db.query(`LOCK TABLE ${names.map(name => 'public.' + quoteIdentifier(name)).join(',')} IN ACCESS EXCLUSIVE MODE`);
  };
  const readRun = async (): Promise<Run | undefined> => {
    const state = (await db.query("SELECT to_regnamespace('sinegasi_ops') IS NOT NULL AS schema,to_regclass('sinegasi_ops.production_reconciliation_runs') IS NOT NULL AS history")).rows[0];
    if (state?.schema === false && state.history === false) return undefined;
    if (state?.schema !== true || state.history !== true) throw new WriterError('UNREVIEWED_OPERATIONS_SCHEMA_REFUSED');
    const relations = (await db.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sinegasi_ops' AND c.relkind IN ('r','p','v','m','S')")).rows;
    if (relations.length !== 1 || relations[0].relname !== 'production_reconciliation_runs') throw new WriterError('UNREVIEWED_OPERATIONS_HISTORY_REFUSED');
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const access = (await db.query(`SELECT has_schema_privilege($1,'sinegasi_ops','USAGE') AS usage,
        has_schema_privilege($1,'sinegasi_ops','CREATE') AS create,has_table_privilege($1,'${HISTORY}','SELECT') AS read,
        has_table_privilege($1,'${HISTORY}','INSERT') AS insert,has_table_privilege($1,'${HISTORY}','UPDATE') AS update,
        has_table_privilege($1,'${HISTORY}','DELETE') AS delete`, [role])).rows[0];
      if (!access || Object.values(access).some(value => value !== false)) throw new WriterError('PRIVATE_WRITER_HISTORY_EXPOSED');
    }
    const rows = (await db.query(`SELECT package_sha256,approval_sha256,release_sha,backup_inventory_sha256,stage,enums_catalog_sha256,target_catalog_sha256 FROM ${HISTORY}`)).rows;
    if (rows.length !== 1) throw new WriterError('WRITER_HISTORY_STATE_INVALID');
    const r = object(rows[0]);
    if (r.package_sha256 !== bundle.packageSha256 || r.approval_sha256 !== approvalSha256 || r.release_sha !== auth.releaseSha
      || r.backup_inventory_sha256 !== backupHash || !['enums', 'complete'].includes(String(r.stage))
      || typeof r.enums_catalog_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(r.enums_catalog_sha256)
      || (r.stage === 'enums' ? r.target_catalog_sha256 !== null : typeof r.target_catalog_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(r.target_catalog_sha256))) {
      throw new WriterError('WRITER_HISTORY_BINDING_MISMATCH');
    }
    return r as unknown as Run;
  };
  try {
    await begin();
    if ((await db.query(LOCK)).rows[0]?.acquired !== true) throw new WriterError('CONCURRENT_WRITER_REFUSED');
    lock = true;
    await lockPublic();
    const prior = await readRun();
    if (prior?.stage === 'enums') mutation = 'enums';
    if (prior?.stage === 'complete') {
      const target = await verifyWriterTarget(db, bundle.snapshot, bundle.reference);
      if (writerCatalogHash(target) !== prior.target_catalog_sha256) throw new WriterError('COMPLETED_CATALOG_DRIFT_REFUSED');
      await db.query('ROLLBACK'); transaction = false;
      return { mode: 'noop', packageSha256: bundle.packageSha256, mutation: 'none', managedAcceptanceRequired: true };
    }
    const baseline = await readWriterCatalog(db);
    validateLegacyInventory(baseline.inventory, bundle.snapshot);
    if (prior) {
      if (writerCatalogHash(baseline) !== prior.enums_catalog_sha256) throw new WriterError('RESUME_CATALOG_DRIFT_REFUSED');
      await db.query('ROLLBACK'); transaction = false;
    } else {
      if (writerCatalogHash(baseline) !== approval.baselineCatalogSha256 || sha256(JSON.stringify(baseline.inventory)) !== backupHash) {
        throw new WriterError('APPROVED_CATALOG_OR_BACKUP_PARITY_CHANGED');
      }
      await db.query(`CREATE SCHEMA sinegasi_ops; REVOKE ALL ON SCHEMA sinegasi_ops FROM PUBLIC,anon,authenticated,service_role;
        CREATE TABLE ${HISTORY}(
          package_sha256 text PRIMARY KEY CHECK(package_sha256 ~ '^[a-f0-9]{64}$'),approval_sha256 text NOT NULL,
          release_sha text NOT NULL,backup_inventory_sha256 text NOT NULL,stage text NOT NULL CHECK(stage IN ('enums','complete')),
          enums_catalog_sha256 text NOT NULL,target_catalog_sha256 text,applied_at timestamptz NOT NULL DEFAULT now());
        REVOKE ALL ON ${HISTORY} FROM PUBLIC,anon,authenticated,service_role`);
      await execute(bundle.sql[0]);
      const enums = await readWriterCatalog(db);
      // Before committing, confirm only the enum catalog changed, not columns/data/ACLs.
      const stripEnums = (i: DatabaseInventory): DatabaseInventory => ({ ...i, structure: i.structure.filter(o => o.kind !== 'enum') });
      if (JSON.stringify(stripEnums(enums.inventory)) !== JSON.stringify(stripEnums(baseline.inventory))
        || JSON.stringify(enums.security) !== JSON.stringify(baseline.security)) throw new WriterError('UNEXPECTED_ENUM_PHASE_DRIFT');
      await db.query(`INSERT INTO ${HISTORY}(package_sha256,approval_sha256,release_sha,backup_inventory_sha256,stage,enums_catalog_sha256)
        VALUES($1,$2,$3,$4,'enums',$5)`, [bundle.packageSha256, approvalSha256, auth.releaseSha, backupHash, writerCatalogHash(enums)]);
      await commit(); mutation = 'enums';
    }
    await begin();
    await lockPublic();
    const run = await readRun();
    if (run?.stage !== 'enums' || writerCatalogHash(await readWriterCatalog(db)) !== run.enums_catalog_sha256) throw new WriterError('ENUM_CHECKPOINT_CHANGED');
    await execute(bundle.sql[1]);
    await insertReferenceRows(db, bundle.reference);
    const target = await verifyWriterTarget(db, bundle.snapshot, bundle.reference);
    await db.query(`UPDATE ${HISTORY} SET stage='complete',target_catalog_sha256=$2 WHERE package_sha256=$1 AND stage='enums'`, [bundle.packageSha256, writerCatalogHash(target)]);
    await commit(); mutation = 'complete';
    // Reconnect/retry never silently guesses what a failed COMMIT did.
    return { mode: prior ? 'resumed' : 'applied', packageSha256: bundle.packageSha256, mutation, managedAcceptanceRequired: true };
  } catch (error: unknown) {
    if (committing) mutation = 'unknown';
    if (transaction) {
      try { await db.query('ROLLBACK'); } catch { mutation = 'unknown'; }
    }
    const stage = committing ? 'COMMIT_UNCERTAIN_INSPECT_HISTORY_BEFORE_RETRY'
      : error instanceof WriterError ? error.stage : 'WRITER_FAILED_INSPECT_CHECKPOINT';
    throw new WriterError(stage, mutation);
  } finally {
    if (lock) {
      try {
        const result = await db.query("SELECT pg_advisory_unlock(hashtext('sinegasi:schema-migrations')) AS released");
        if (result.rows[0]?.released !== true) throw new Error('LOCK_NOT_RELEASED');
      } catch { throw new WriterError('WRITER_LOCK_RELEASE_UNCERTAIN_INSPECT_BEFORE_RETRY', mutation); }
    }
  }
}
