import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from '../services/passwordService.js';

export interface BootstrapDatabase {
  query(sql: string, values?: readonly unknown[]): Promise<{ rows: ReadonlyArray<Record<string, unknown>> }>;
}

export interface BootstrapTeacherOptions {
  projectRef: string;
  username: string;
  nama: string;
  apply: boolean;
  confirmProject?: string;
}

export interface BootstrapTeacherCredential {
  version: 1;
  projectRef: string;
  userId: string;
  username: string;
  nama: string;
  role: 'teacher';
  temporaryPassword: string;
  isFirstLogin: true;
}

export interface BootstrapCredentialStore {
  create(credential: BootstrapTeacherCredential): Promise<{ remove(): Promise<void> }>;
}

export interface BootstrapTeacherDependencies {
  database: BootstrapDatabase;
  credentials: BootstrapCredentialStore;
  /** Production authorization is rechecked under the account lock, before secrets exist. */
  beforeCreate?: () => Promise<void>;
  /** Final postcondition/window check inside the same transaction, before COMMIT. */
  beforeCommit?: () => Promise<void>;
}

export type BootstrapTeacherResult =
  | { mode: 'dry-run'; role: 'teacher'; isFirstLogin: true; databaseChecked: false }
  | { mode: 'applied'; role: 'teacher'; isFirstLogin: true; userId: string };

export class BootstrapTeacherError extends Error {
  constructor(public readonly code: string) {
    // Never attach database errors: PostgreSQL details can contain credentials.
    super(code);
    this.name = 'BootstrapTeacherError';
  }
}

export function validateBootstrapTeacherOptions(options: BootstrapTeacherOptions): void {
  if (!/^[a-z0-9]{20}$/.test(options.projectRef)) throw new BootstrapTeacherError('BOOTSTRAP_PROJECT_INVALID');
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(options.username)) throw new BootstrapTeacherError('BOOTSTRAP_USERNAME_INVALID');
  if (options.nama !== options.nama.trim() || options.nama.length < 2 || options.nama.length > 200
      || /[\u0000-\u001f\u007f]/u.test(options.nama)) {
    throw new BootstrapTeacherError('BOOTSTRAP_NAME_INVALID');
  }
  if (options.apply && options.confirmProject !== options.projectRef) {
    throw new BootstrapTeacherError('BOOTSTRAP_CONFIRM_PROJECT_REQUIRED');
  }
}

const SCHEMA_READINESS_SQL = `
SELECT (
  (SELECT count(*) = 8 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'users'
     AND column_name IN ('id', 'username', 'password_hash', 'nama', 'role', 'is_first_login', 'is_active', 'auth_version'))
  AND EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
              JOIN pg_namespace n ON n.oid = t.typnamespace
              WHERE n.nspname = 'public' AND t.typname = 'user_role' AND e.enumlabel = 'teacher')
  AND to_regprocedure('public.write_audit_log(uuid,text,text,uuid,jsonb,jsonb,text,uuid,uuid,text,text,jsonb)') IS NOT NULL
  AND to_regprocedure('public.redact_audit_json(jsonb)') IS NOT NULL
  AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'log_activity'
                AND p.pronargs = 0 AND p.prosrc LIKE '%app.skip_legacy_audit%'
                AND p.prosrc LIKE '%redact_audit_json%')
) AS ready`;

/** Offline by default; only a caller with an explicitly verified connection may apply. */
export async function bootstrapFirstTeacher(
  options: BootstrapTeacherOptions,
  dependencies: BootstrapTeacherDependencies,
): Promise<BootstrapTeacherResult> {
  validateBootstrapTeacherOptions(options);
  if (!options.apply) return { mode: 'dry-run', role: 'teacher', isFirstLogin: true, databaseChecked: false };

  const { database, credentials } = dependencies;
  let transactionStarted = false;
  let committing = false;
  let credentialFile: Awaited<ReturnType<BootstrapCredentialStore['create']>> | undefined;
  try {
    await database.query('BEGIN');
    transactionStarted = true;
    await database.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'");
    // The table lock also serializes unrelated account writers, not only this script.
    await database.query('LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE');
    await dependencies.beforeCreate?.();
    const existing = await database.query('SELECT EXISTS (SELECT 1 FROM public.users) AS nonempty');
    if (existing.rows[0]?.nonempty !== false) throw new BootstrapTeacherError('BOOTSTRAP_USERS_NOT_EMPTY');
    const schema = await database.query(SCHEMA_READINESS_SQL);
    if (schema.rows[0]?.ready !== true) throw new BootstrapTeacherError('BOOTSTRAP_SCHEMA_NOT_READY');
    const permissions = await database.query(`
      SELECT count(DISTINCT permission_key) = 2 AS ready
      FROM public.access_role_permissions
      WHERE role_key = 'teacher' AND permission_key IN ('users.manage', 'access_control.manage')`);
    if (permissions.rows[0]?.ready !== true) throw new BootstrapTeacherError('BOOTSTRAP_TEACHER_PERMISSIONS_NOT_READY');

    const userId = randomUUID();
    const temporaryPassword = `Guru-${randomBytes(24).toString('base64url')}-1`;
    const passwordHash = await hashPassword(temporaryPassword);
    // Persist credentials securely before committing the account. Neither is returned.
    credentialFile = await credentials.create({
      version: 1, projectRef: options.projectRef, userId, username: options.username,
      nama: options.nama, role: 'teacher', temporaryPassword, isFirstLogin: true,
    });
    await database.query("SELECT set_config('app.skip_legacy_audit', 'true', true)");
    await database.query(`
      INSERT INTO public.users (id, username, password_hash, nama, role, is_first_login, is_active, auth_version)
      VALUES ($1, $2, $3, $4, 'teacher', true, true, 1)`,
    [userId, options.username, passwordHash, options.nama]);
    const sanitizedSnapshot = JSON.stringify({
      id: userId, username: options.username, nama: options.nama, role: 'teacher',
      is_first_login: true, is_active: true, auth_version: 1,
    });
    await database.query(`
      SELECT public.write_audit_log(
        $1::uuid, 'INSERT', 'users', $1::uuid, NULL, $2::jsonb,
        'SYSTEM:BOOTSTRAP_FIRST_TEACHER - approved initial configuration',
        NULL, $3::uuid, 'bootstrap', NULL, '{"operation":"bootstrap_first_teacher"}'::jsonb
      )`, [userId, sanitizedSnapshot, randomUUID()]);
    const audit = await database.query(`
      SELECT (count(*) = 1 AND bool_and(
        user_id = $1::uuid AND source = 'bootstrap' AND action = 'INSERT'
        AND old_values IS NULL AND new_values = $2::jsonb
      )) AS ready FROM public.activity_logs
      WHERE table_name = 'users' AND record_id = $1::uuid`, [userId, sanitizedSnapshot]);
    // Reject unexpected legacy trigger rows or altered/secret-bearing snapshots.
    if (audit.rows[0]?.ready !== true) throw new BootstrapTeacherError('BOOTSTRAP_AUDIT_NOT_CANONICAL');
    await dependencies.beforeCommit?.();
    committing = true;
    await database.query('COMMIT');
    return { mode: 'applied', role: 'teacher', isFirstLogin: true, userId };
  } catch (error: unknown) {
    let rollbackUncertain = false;
    if (transactionStarted) {
      try { await database.query('ROLLBACK'); } catch { rollbackUncertain = true; }
    }
    // A lost COMMIT acknowledgement is ambiguous. Keep the only credential copy
    // for a read-only reconciliation; never retry account creation automatically.
    if (committing) throw new BootstrapTeacherError('BOOTSTRAP_COMMIT_UNCERTAIN_CREDENTIAL_FILE_PRESERVED');
    if (rollbackUncertain) throw new BootstrapTeacherError('BOOTSTRAP_ROLLBACK_UNCERTAIN_INSPECT_BEFORE_RETRY');
    if (credentialFile) {
      try { await credentialFile.remove(); }
      catch { throw new BootstrapTeacherError('BOOTSTRAP_CREDENTIAL_CLEANUP_FAILED'); }
    }
    if (error instanceof BootstrapTeacherError) throw error;
    throw new BootstrapTeacherError('BOOTSTRAP_FAILED');
  }
}
