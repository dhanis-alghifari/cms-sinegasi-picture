import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { bootstrapFirstTeacher, type BootstrapTeacherCredential } from './bootstrapTeacherCore.js';
import { hashPassword, verifyPassword } from '../services/passwordService.js';
import { compileReconciliation, sha256, validateSnapshot } from './productionReconciliation.js';
import { createReferenceDataPlan, rehearseReferenceData } from './productionReferenceData.js';
import { fixtureJwt, requireIsolatedApiTarget } from './productionApiRehearsalCore.js';

let stage = 'ISOLATED_GUARD';
let lastHttpStatus: number | undefined;
const checks: string[] = [];
const host = '127.0.0.1';
const databaseName = 'sinegasi_schema_fresh';

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function token(value: Record<string, unknown>): string {
  assert.equal(typeof value.token, 'string');
  return String(value.token);
}
async function main(): Promise<void> {
  if (process.argv.length !== 3 || process.argv[2] !== 'isolated-api'
    || process.env.ENV_FILE_LOADING !== 'disabled') throw new Error('ISOLATED_MODE_REQUIRED');
  requireIsolatedApiTarget(host, databaseName);
  const db = new pg.Client({ host, database: databaseName, user: 'postgres', port: 5432,
    connectionTimeoutMillis: 3000, query_timeout: 15_000 });
  db.on('error', () => {});
  await db.connect();
  let credential: BootstrapTeacherCredential | undefined;
  let closeApplication: (() => Promise<void>) | undefined;
  let unavailable = false;
  const serviceKey = fixtureJwt('service_role');
  const proxy = createServer({ key: await readFile(resolve(__dirname, '../fixture-tls.key')),
    cert: await readFile(resolve(__dirname, '../fixture-tls.crt')) }, async (request, response) => {
    // Only the REST prefix is forwarded, always to the same loopback destination.
    if (!request.url?.startsWith('/rest/v1/') || unavailable) { response.writeHead(503).end(); return; }
    try {
      const parts: Buffer[] = [];
      let size = 0;
      for await (const part of request) {
        size += part.length;
        if (size > 2 * 1024 * 1024) { response.writeHead(413).end(); return; }
        parts.push(Buffer.from(part));
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value && !['host', 'connection', 'content-length', 'transfer-encoding'].includes(key)) headers.set(key, Array.isArray(value) ? value.join(',') : value);
      }
      const upstream = await fetch(`http://127.0.0.1:3000${request.url.slice('/rest/v1'.length)}`, {
        method: request.method, headers, ...(size ? { body: Buffer.concat(parts) } : {}),
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      const replyHeaders: Record<string, string> = {};
      upstream.headers.forEach((value, key) => { if (!['connection', 'transfer-encoding', 'content-length'].includes(key)) replyHeaders[key] = value; });
      response.writeHead(upstream.status, replyHeaders).end(Buffer.from(await upstream.arrayBuffer()));
    } catch { if (!response.headersSent) response.writeHead(503); response.end(); }
  });
  try {
    stage = 'EXACT_RUNTIME_DEPENDENCIES';
    const expected: unknown = JSON.parse(await readFile(resolve(__dirname, '../runtime-dependencies.json'), 'utf8'));
    for (const [name, version] of Object.entries(record(expected))) {
      assert.match(name, /^(?:@[a-z0-9-]+\/)?[a-z0-9_.-]+(?:\/node_modules\/(?:@[a-z0-9-]+\/)?[a-z0-9_.-]+)*$/);
      const installed = record(JSON.parse(await readFile(resolve(__dirname, '../node_modules', name, 'package.json'), 'utf8')));
      assert.equal(installed.version, version);
    }
    checks.push(stage);
    stage = 'EMPTY_DISPOSABLE_CONFIG_AND_BOOTSTRAP';
    assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name, databaseName);
    const snapshot: unknown = JSON.parse(await readFile(resolve(__dirname, '../production-schema.snapshot.json'), 'utf8'));
    validateSnapshot(snapshot);
    const fingerprint = sha256(compileReconciliation(snapshot).join('\n'));
    const plan = createReferenceDataPlan(snapshot, fingerprint, 5000);
    const adapter = { query: (sql: string, values?: readonly unknown[]) => db.query(sql, values ? [...values] : undefined) };
    await rehearseReferenceData(adapter, snapshot, fingerprint, 5000, plan.checksum);
    await bootstrapFirstTeacher({ projectRef: snapshot.targetProject, confirmProject: snapshot.targetProject,
      username: 'admin', nama: 'Isolated API Fixture', apply: true }, {
      database: adapter, credentials: { async create(value) {
        credential = value;
        return { async remove() { credential = undefined; } };
      } },
    });
    assert.ok(credential);
    checks.push(stage);
    stage = 'POSTGREST_READY';
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      try { const response = await fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } }
      catch { /* Startup race only; no production endpoint is reachable. */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready);
    await new Promise<void>((resolve, reject) => { proxy.once('error', reject); proxy.listen(8443, '127.0.0.1', resolve); });
    Object.assign(process.env, {
      NODE_ENV: 'production', PUBLIC_DEPLOYMENT: 'true', ALLOW_DEV_AUTH: 'false', BACKGROUND_JOBS_ENABLED: 'false',
      NTFY_ENABLED: 'false', CORS_ORIGINS: 'https://localhost', HOST: '127.0.0.1', TRUST_PROXY: 'false',
      JWT_SECRET: randomBytes(48).toString('base64url'), SUPABASE_URL: 'https://localhost:8443', SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    });
    const { runtimeConfig } = await import('../config/env.js');
    assert.equal(runtimeConfig.publicDeployment, true); assert.equal(runtimeConfig.allowDevelopmentAuth, false);
    assert.equal(runtimeConfig.backgroundJobsEnabled, false);
    const { createApplication } = await import('../app/createApplication.js');
    const application = await createApplication();
    application.app.log.level = 'silent';
    closeApplication = () => application.app.close();
    await application.app.listen({ host: '127.0.0.1', port: 5002 });
    application.startWorkers(); // Must be a no-op under the same production worker flag.
    const { clearAuthStateCache } = await import('../modules/auth/auth.identity.js');
    checks.push('PUBLIC_DEPLOYMENT_NO_MOCKS_WORKERS_DISABLED');
    const call = async (path: string, status: number, auth?: string, body?: Record<string, unknown>, method = body ? 'POST' : 'GET', key?: string): Promise<Record<string, unknown>> => {
      const response = await fetch(`http://127.0.0.1:5002${path}`, { method, signal: AbortSignal.timeout(10_000),
        headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(key ? { 'X-Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      lastHttpStatus = response.status;
      assert.equal(response.status, status);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      return record(await response.json());
    };
    stage = 'NO_TOKEN_REJECTED'; await call('/api/access-control/matrix', 401); checks.push(stage);
    stage = 'INVALID_LOGIN_REJECTED'; await call('/api/auth/login', 401, undefined, { username: 'admin', password: 'WrongFixture123' }); checks.push(stage);
    stage = 'FIXTURE_FIRST_LOGIN';
    const first = await call('/api/auth/login', 200, undefined, { username: 'admin', password: credential.temporaryPassword });
    const firstToken = token(first); assert.equal(record(first.user).is_first_login, true); checks.push(stage);
    stage = 'FIRST_LOGIN_OPERATION_BLOCKED'; await call('/api/access-control/matrix', 403, firstToken); checks.push(stage);
    stage = 'PASSWORD_MISMATCH_NO_CHANGE';
    await call('/api/auth/change-password', 400, firstToken, { current_password: credential.temporaryPassword, new_password: 'NewFixture123!', confirm_password: 'DifferentFixture123!' });
    assert.equal((await db.query("SELECT auth_version FROM public.users WHERE username='admin'")).rows[0].auth_version, 1); checks.push(stage);
    stage = 'PASSWORD_RPC_AND_AUDIT';
    const newPassword = `Fixture7-${randomBytes(18).toString('base64url')}`;
    const changed = await call('/api/auth/change-password', 200, firstToken, { current_password: credential.temporaryPassword, new_password: newPassword, confirm_password: newPassword });
    const adminToken = token(changed);
    const admin = (await db.query("SELECT id,password_hash,is_first_login,auth_version FROM public.users WHERE username='admin'")).rows[0];
    assert.equal(admin.auth_version, 2); assert.equal(admin.is_first_login, false);
    assert.equal((await verifyPassword(newPassword, admin.password_hash)).valid, true);
    assert.ok(Number((await db.query('SELECT count(*) AS count FROM public.activity_logs')).rows[0].count) >= 2); checks.push(stage);
    stage = 'OLD_JWT_REVOKED'; await call('/api/auth/me', 401, firstToken); checks.push(stage);
    stage = 'OLD_PASSWORD_REJECTED'; await call('/api/auth/login', 401, undefined, { username: 'admin', password: credential.temporaryPassword }); checks.push(stage);
    credential.temporaryPassword = ''; credential = undefined;
    stage = 'NEW_PASSWORD_LOGIN'; await call('/api/auth/login', 200, undefined, { username: 'admin', password: newPassword }); checks.push(stage);
    stage = 'TEACHER_CONFIG_AND_EMPTY_DASHBOARD'; await call('/api/access-control/matrix', 200, adminToken); await call('/api/dashboard/summary', 200, adminToken); checks.push(stage);
    stage = 'MEMBER_FIXTURE_OWNERSHIP';
    const memberPassword = `Member7-${randomBytes(18).toString('base64url')}`;
    const memberId = randomUUID(), studentId = randomUUID(), otherStudentId = randomUUID();
    await db.query("INSERT INTO public.users(id,username,password_hash,nama,role,is_first_login) VALUES($1,'fixture_member',$2,'Fixture Member','member',false)", [memberId, await hashPassword(memberPassword)]);
    await db.query("INSERT INTO public.students(id,user_id,nis,nama,kelas) VALUES($1,$2,'FIXTURE001','Fixture Member','X Fixture'),($3,NULL,'FIXTURE002','Fixture Other','X Fixture')", [studentId, memberId, otherStudentId]);
    const memberToken = token(await call('/api/auth/login', 200, undefined, { username: 'fixture_member', password: memberPassword }));
    await call(`/api/students/${studentId}/dashboard-summary`, 200, memberToken);
    await call(`/api/students/${otherStudentId}/dashboard-summary`, 403, memberToken);
    await call('/api/access-control/matrix', 403, memberToken); checks.push(stage);
    stage = 'MEMBER_CASH_MUTATION_DENIED';
    const cashIn = { amount: 5000, description: 'Disposable rehearsal income', type: 'other_income', payment_method: 'cash' };
    await call('/api/cash/transactions/in', 403, memberToken, cashIn, 'POST', 'fixture-member-denied');
    assert.equal(Number((await db.query('SELECT count(*) AS count FROM public.cash_transactions')).rows[0].count), 0); checks.push(stage);
    stage = 'CASH_RPC_AND_REPLAY_NO_DUPLICATE';
    const income = await call('/api/cash/transactions/in', 201, adminToken, cashIn, 'POST', 'fixture-income-once');
    await call('/api/cash/transactions/in', 201, adminToken, cashIn, 'POST', 'fixture-income-once');
    assert.equal(Number((await db.query('SELECT count(*) AS count FROM public.cash_transactions')).rows[0].count), 1);
    assert.equal(Number((await db.query('SELECT saldo_sesudah FROM public.cash_transactions WHERE id=$1', [record(income.data).id])).rows[0].saldo_sesudah), 5000); checks.push(stage);
    stage = 'CASH_OUT_AND_BALANCE';
    const out = await call('/api/cash/transactions/out', 201, adminToken, { amount: 1000, description: 'Disposable rehearsal expense', payment_method: 'cash' }, 'POST', 'fixture-expense-once');
    assert.equal(Number((await db.query('SELECT saldo_sesudah FROM public.cash_transactions WHERE id=$1', [record(out.data).id])).rows[0].saldo_sesudah), 4000); checks.push(stage);
    stage = 'CASH_INSUFFICIENT_BALANCE_ROLLBACK';
    await call('/api/cash/transactions/out', 400, adminToken, { amount: 9000, description: 'Disposable rejected expense', payment_method: 'cash' }, 'POST', 'fixture-expense-rejected');
    assert.equal(Number((await db.query('SELECT count(*) AS count FROM public.cash_transactions')).rows[0].count), 2); checks.push(stage);
    stage = 'BROWSER_TABLE_AND_RPC_DENIED';
    for (const role of ['anon', 'authenticated'] as const) {
      for (const path of ['users?select=id', 'rpc/is_login_rate_limited']) {
        const rpc = path.startsWith('rpc/');
        const response = await fetch(`http://127.0.0.1:3000/${path}`, {
          method: rpc ? 'POST' : 'GET', headers: { Authorization: `Bearer ${fixtureJwt(role)}`, 'Content-Type': 'application/json' },
          ...(rpc ? { body: JSON.stringify({ p_rate_key: 'fixture-only-browser-denial', p_window_seconds: 300, p_max_attempts: 10 }) } : {}),
          signal: AbortSignal.timeout(2000),
        });
        assert.ok([401, 403, 404].includes(response.status));
      }
    }
    checks.push(stage);
    stage = 'INACTIVE_ACCOUNT_REJECTED'; lastHttpStatus = undefined;
    await db.query('BEGIN');
    try {
      await db.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.change_reason',$2,true)",
        [admin.id, 'Deactivate disposable member for authentication test']);
      await db.query('UPDATE public.users SET is_active=false WHERE id=$1', [memberId]);
      await db.query('COMMIT');
    } catch (error: unknown) { await db.query('ROLLBACK'); throw error; }
    clearAuthStateCache(memberId);
    await call('/api/auth/me', 401, memberToken); checks.push(stage);
    stage = 'DATABASE_OUTAGE_FAILS_CLOSED'; unavailable = true; clearAuthStateCache();
    await call('/api/auth/login', 503, undefined, { username: 'admin', password: newPassword });
    await call('/api/auth/me', 503, adminToken); checks.push(stage);
    console.log(JSON.stringify({ status: 'ISOLATED_APPLICATION_API_REHEARSAL_PASSED', schemaPackageSha256: fingerprint,
      referenceChecksum: plan.checksum, checks, transport: 'real loopback HTTP backend and trusted HTTPS REST adapter',
      databaseVersion: (await db.query("SELECT current_setting('server_version') AS version")).rows[0].version,
      postgrestMajor: 14, isolatedApplicationFlowTestsPassed: true, fullApplicationAcceptancePassed: false,
      managedSupabaseIntegrationTested: false, mediaStorageTested: false, productionChanged: false,
      devDatabaseChanged: false, productionApproved: false, liveAccountCreated: false }));
  } finally {
    if (credential) credential.temporaryPassword = '';
    await closeApplication?.();
    proxy.closeAllConnections();
    if (proxy.listening) await new Promise<void>((resolve, reject) => proxy.close(error => error ? reject(error) : resolve()));
    await db.end();
  }
}
if (require.main === module) void main().catch((error: unknown) => {
  const databaseErrorCode = error instanceof pg.DatabaseError && error.code && /^[A-Z0-9]{5}$/.test(error.code)
    ? error.code : undefined;
  console.log(JSON.stringify({ status: 'ISOLATED_APPLICATION_API_REHEARSAL_FAILED', stage, lastHttpStatus, databaseErrorCode, productionChanged: false }));
  process.exitCode = 1;
});
