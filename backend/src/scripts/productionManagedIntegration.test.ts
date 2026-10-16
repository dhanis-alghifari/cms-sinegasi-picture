import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createReferenceDataPlan } from './productionReferenceData.js';
import { verifyCandidateFiles } from './productionReconciliation.js';
import { createReadOnlyTransport, INTEGRATION_ORIGIN, INTEGRATION_PRIVATE_JOURNALS, INTEGRATION_PROJECT, integrationTableAccess, managedReadOnlyClient,
  requireIntegrationArguments, requirePermissionDenial, validateIntegrationKey, verifyManagedReads } from './productionManagedIntegrationCore.js';

test('only exact production project and explicit read-only mode accepted', () => {
  assert.equal(requireIntegrationArguments(['plan']), 'plan');
  assert.equal(requireIntegrationArguments(['check', '--confirm-project', INTEGRATION_PROJECT]), 'check');
  for (const args of [[], ['apply'], ['check'], ['check', '--confirm-project', 'dev'],
    ['check', '--confirm-project', INTEGRATION_PROJECT, '--write']]) assert.throws(() => requireIntegrationArguments(args));
});

test('API key role/project/expiry guard sanitizes errors and accepts both supported key formats', () => {
  const jwt = (value: unknown) => `e30.${Buffer.from(JSON.stringify(value)).toString('base64url')}.fixture`;
  for (const role of ['service_role', 'anon'] as const) {
    const valid = jwt({ role, ref: INTEGRATION_PROJECT, exp: 2_000_000_000 });
    assert.equal(validateIntegrationKey(valid, role, 1_900_000_000_000), valid);
    for (const value of [{ role, ref: 'dev', exp: 2_000_000_000 }, { role, ref: INTEGRATION_PROJECT, exp: 1 },
      { role: 'authenticated', ref: INTEGRATION_PROJECT, exp: 2_000_000_000 }]) {
      assert.throws(() => validateIntegrationKey(jwt(value), role), /API_KEY_ROLE_PROJECT_OR_FORMAT_INVALID/);
    }
  }
  const secret = 'sb_secret_fixture_only_not_a_live_key';
  const publishable = 'sb_publishable_fixture_only_not_a_live_key';
  assert.equal(validateIntegrationKey(secret, 'service_role'), secret);
  assert.equal(validateIntegrationKey(publishable, 'anon'), publishable);
  assert.throws(() => validateIntegrationKey(secret, 'anon'));
  assert.throws(() => validateIntegrationKey('postgresql://sensitive@invalid', 'service_role'),
    error => error instanceof Error && !error.message.includes('sensitive'));
});

test('transport preserves request headers, forces no redirects and supplies deadline', async () => {
  const transport = createReadOnlyTransport(['users'], async (input, init) => {
    const request = new Request(input);
    assert.equal(request.headers.get('apikey'), 'test-only');
    assert.equal(request.method, 'HEAD');
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    return new Response(null, { status: 200 });
  });
  await transport.fetch(new Request(`${INTEGRATION_ORIGIN}/rest/v1/users?select=id`, { method: 'HEAD', headers: { apikey: 'test-only' } }));
  assert.deepEqual(transport.observations, { sent: 1, blocked: 0 });
});

test('write, wrong target, unsafe path, Auth/Storage, private schema and non-allowlisted RPC never reach network', async () => {
  let calls = 0;
  const transport = createReadOnlyTransport(['users'], async () => { calls++; return new Response('[]'); });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    await assert.rejects(transport.fetch(`${INTEGRATION_ORIGIN}/rest/v1/users`, { method }), /READ_ONLY_REQUEST_BARRIER/);
  }
  for (const url of ['https://example.com/rest/v1/users', 'http://pvbdiftvzoeelibxlxzb.supabase.co/rest/v1/users',
    `${INTEGRATION_ORIGIN}/auth/v1/token`, `${INTEGRATION_ORIGIN}/storage/v1/object/list/private`,
    `${INTEGRATION_ORIGIN}/rest/v1/rpc/consume_api_rate_limit_atomic`, `${INTEGRATION_ORIGIN}/rest/v1/rpc/generate_weekly_cash_billing`,
    `${INTEGRATION_ORIGIN}/rest/v1/private_table`, `${INTEGRATION_ORIGIN}/rest/v1/%75sers`,
    `${INTEGRATION_ORIGIN}/rest/v1/users#bad`, 'https://user:password@pvbdiftvzoeelibxlxzb.supabase.co/rest/v1/users']) {
    await assert.rejects(transport.fetch(url));
  }
  for (const header of ['Accept-Profile', 'Content-Profile']) {
    await assert.rejects(transport.fetch(`${INTEGRATION_ORIGIN}/rest/v1/users`, { headers: { [header]: 'sinegasi_ops' } }), /READ_ONLY_REQUEST_BARRIER/);
  }
  assert.equal(calls, 0);
});

test('signal cancellation, unexpected redirects and request budget fail closed', async () => {
  const controller = new AbortController(); controller.abort();
  const cancelled = createReadOnlyTransport(['users'], async (_input, init) => {
    assert.equal(init?.signal?.aborted, true); throw new Error('cancelled');
  });
  await assert.rejects(cancelled.fetch(`${INTEGRATION_ORIGIN}/rest/v1/users`, { signal: controller.signal }));
  const redirected = createReadOnlyTransport(['users'], async () => {
    const result = new Response('[]'); Object.defineProperty(result, 'redirected', { value: true }); return result;
  });
  await assert.rejects(redirected.fetch(`${INTEGRATION_ORIGIN}/rest/v1/users`), /UNEXPECTED_RESPONSE_TARGET/);
  const budget = createReadOnlyTransport(['users'], async () => new Response('[]'));
  for (let index = 0; index < 300; index++) await budget.fetch(`${INTEGRATION_ORIGIN}/rest/v1/users`);
  await assert.rejects(budget.fetch(`${INTEGRATION_ORIGIN}/rest/v1/users`), /REQUEST_BUDGET_EXCEEDED/);
  assert.equal(budget.observations.sent, 300);
});

test('SDK mutation is blocked before fetch; GET RPC and anonymous SQLSTATE denial are distinct', async () => {
  let calls = 0;
  const transport = createReadOnlyTransport(['users'], async () => { calls++; return new Response('false', { headers: { 'Content-Type': 'application/json' } }); });
  const client = managedReadOnlyClient('sb_secret_fixture_only_not_a_live_key', transport);
  assert.ok((await client.from('users').insert({ id: 'fixture' })).error);
  assert.ok((await client.rpc('is_login_rate_limited', { p_rate_key: 'fixture-only' })).error);
  assert.equal(calls, 0);
  assert.equal((await client.rpc('is_login_rate_limited', { p_rate_key: 'fixture-only' }, { get: true })).data, false);
  assert.equal(calls, 1);
  requirePermissionDenial({ status: 401, error: { code: '42501' } });
  requirePermissionDenial({ status: 403, error: { code: '42501' } });
  for (const result of [{ status: 200, error: null }, { status: 401, error: { code: 'PGRST301' } },
    { status: 404, error: { code: 'PGRST205' } }, { status: 503, error: { code: '42501' } }]) assert.throws(() => requirePermissionDenial(result));
});

const PRIVATE_JOURNALS = ['agenda_migration_history', 'borrowing_migration_history', 'cash_migration_history',
  'contest_migration_history', 'schema_migrations'] as const;
const SERVICE_FIXTURE_KEY = 'sb_secret_fixture_only_not_a_live_key';
const PUBLIC_FIXTURE_KEY = 'sb_publishable_fixture_only_not_a_live_key';

async function managedFixture(override?: (request: Request, name: string) => Response | undefined) {
  const candidate = await verifyCandidateFiles('..');
  const reference = createReferenceDataPlan(candidate.snapshot, candidate.fingerprint, 5000);
  const byName = new Map(reference.tables.map(table => [table.name, table]));
  const requests: Request[] = [];
  const checks: string[] = [];
  const transport = createReadOnlyTransport([...candidate.snapshot.tables.map(table => table.relname), ...candidate.snapshot.views.map(view => view.name)], async input => {
    const request = new Request(input), name = new URL(request.url).pathname.split('/').at(-1)!;
    requests.push(request);
    const replacement = override?.(request, name);
    if (replacement) return replacement;
    if (request.headers.get('apikey') === PUBLIC_FIXTURE_KEY || PRIVATE_JOURNALS.some(journal => journal === name)) {
      // Managed PostgREST omits the denial body for HEAD; GET is required to prove SQLSTATE.
      return new Response(request.method === 'HEAD' ? null : JSON.stringify({ code: '42501' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    const table = byName.get(name);
    if (request.method === 'HEAD') return new Response(null, { headers: { 'Content-Range': `*/${table?.rows.length ?? 0}` } });
    const data: unknown = table ? table.rows.map(row => Object.fromEntries(table.columns.map((column, index) => [column, row[index]])))
      : name === 'get_operational_dashboard_summary' ? { timezone: 'Asia/Jakarta', kas: { saldoTerakhir: 0 }, absensi: { totalSiswa: 0 }, alat: { totalAlat: 0 }, gradeDistribution: { totalSiswaEvaluated: 0 } }
      : name === 'get_attendance_summary_filtered' ? [{ hadir: 0, sakit: 0, izin: 0, alpha: 0, total: 0 }] : false;
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  });
  return { candidate, reference, requests, checks, transport, verify: () => verifyManagedReads(
    managedReadOnlyClient(SERVICE_FIXTURE_KEY, transport), managedReadOnlyClient(PUBLIC_FIXTURE_KEY, transport),
    candidate.snapshot, reference, stage => checks.push(stage)) };
}

test('managed SDK verifies 68 application tables and proves both roles are denied all five private journals', async () => {
  const fixture = await managedFixture();
  await fixture.verify();
  assert.deepEqual(fixture.checks, ['SERVICE_ROLE_APPLICATION_TABLES_AND_VIEWS_READ',
    'SERVICE_ROLE_MIGRATION_JOURNALS_DENIED', 'CANONICAL_CONFIGURATION_REST_MATCH',
    'THREE_READ_ONLY_RPC_CONTRACTS', 'ANON_ALL_TABLES_VIEWS_AND_THREE_RPCS_DENIED', 'INITIAL_TABLE_COUNTS_UNCHANGED']);
  for (const name of PRIVATE_JOURNALS) {
    const probes = fixture.requests.filter(request => new URL(request.url).pathname === `/rest/v1/${name}`);
    assert.equal(probes.length, 2);
    assert.deepEqual(probes.map(request => request.headers.get('apikey')).sort(), [PUBLIC_FIXTURE_KEY, SERVICE_FIXTURE_KEY].sort());
    for (const request of probes) {
      assert.equal(request.method, 'GET');
      assert.equal(new URL(request.url).searchParams.get('limit'), '0');
    }
  }
  assert.equal(fixture.requests.filter(request => request.method === 'HEAD').length, 68 * 2 + 2);
  assert.deepEqual(fixture.transport.observations, { sent: 230, blocked: 0 });
});

test('journal test expectations match the reviewed SQL grants without changing migration artifacts', async () => {
  const { snapshot, sql } = await verifyCandidateFiles('..');
  const granted = [...sql[1].matchAll(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\."([a-z_]+)" TO service_role;/g)]
    .map(match => match[1]);
  const excluded = snapshot.tables.map(table => table.relname).filter(name => !granted.includes(name));
  assert.equal(granted.length, 68);
  assert.deepEqual(excluded.sort(), [...PRIVATE_JOURNALS].sort());
  assert.deepEqual([...INTEGRATION_PRIVATE_JOURNALS].sort(), [...PRIVATE_JOURNALS].sort());
  assert.deepEqual(integrationTableAccess(snapshot).applicationTables.map(table => table.relname).sort(), granted.sort());
});

test('service access accidentally granted to any private journal fails instead of silently skipping it', async () => {
  for (const journal of PRIVATE_JOURNALS) {
    const fixture = await managedFixture((request, name) => name === journal && request.headers.get('apikey') === SERVICE_FIXTURE_KEY
      ? new Response('[]', { headers: { 'Content-Type': 'application/json' } }) : undefined);
    await assert.rejects(fixture.verify(), /SERVICE_ROLE_MIGRATION_JOURNALS_DENIAL_NOT_PROVEN/);
  }
});

test('invalid key, stale schema, outage and wrong SQLSTATE never masquerade as journal protection', async () => {
  for (const journal of PRIVATE_JOURNALS) {
    for (const [status, code] of [[401, 'PGRST301'], [404, 'PGRST205'], [503, '42501'], [400, '42501'], [403, 'XX000']] as const) {
      const fixture = await managedFixture((request, name) => name === journal && request.headers.get('apikey') === SERVICE_FIXTURE_KEY
        ? new Response(JSON.stringify({ code }), { status, headers: { 'Content-Type': 'application/json' } }) : undefined);
      await assert.rejects(fixture.verify(), /SERVICE_ROLE_MIGRATION_JOURNALS_DENIAL_NOT_PROVEN/);
    }
  }
});

test('anonymous access to any private journal still fails the complete anonymous boundary check', async () => {
  for (const journal of PRIVATE_JOURNALS) {
    const fixture = await managedFixture((request, name) => name === journal && request.headers.get('apikey') === PUBLIC_FIXTURE_KEY
      ? new Response('[]', { headers: { 'Content-Type': 'application/json' } }) : undefined);
    await assert.rejects(fixture.verify(), /ANON_PERMISSION_DENIAL_NOT_PROVEN/);
  }
});

test('denial of an application table is not excused as private journal access', async () => {
  const fixture = await managedFixture((request, name) => name === 'users' && request.headers.get('apikey') === SERVICE_FIXTURE_KEY
    ? new Response(null, { status: 403 }) : undefined);
  await assert.rejects(fixture.verify(), /INITIAL_TABLE_COUNTS_OR_DATA_API_SCHEMA_MISMATCH/);
});

test('nonempty initial application data, changed counts and changed canonical configuration all stop', async () => {
  const occupied = await managedFixture((request, name) => name === 'users' && request.method === 'HEAD'
    ? new Response(null, { headers: { 'Content-Range': '*/1' } }) : undefined);
  await assert.rejects(occupied.verify(), /INITIAL_TABLE_COUNTS_OR_DATA_API_SCHEMA_MISMATCH/);
  let countReads = 0;
  const changed = await managedFixture((request, name) => name === 'users' && request.method === 'HEAD' && ++countReads === 2
    ? new Response(null, { headers: { 'Content-Range': '*/1' } }) : undefined);
  await assert.rejects(changed.verify(), /TABLE_COUNTS_CHANGED_DURING_READ_ONLY_TEST/);
  const configuration = await managedFixture((request, name) => name === 'access_roles' && request.method === 'GET'
    && request.headers.get('apikey') === SERVICE_FIXTURE_KEY
    ? new Response('[]', { headers: { 'Content-Type': 'application/json' } }) : undefined);
  await assert.rejects(configuration.verify(), /REFERENCE_REST_DATA_DRIFT/);
});

test('missing journals and references to private journals fail before any network request', async () => {
  const missing = await managedFixture();
  missing.candidate.snapshot.tables = missing.candidate.snapshot.tables.filter(table => table.relname !== 'schema_migrations');
  await assert.rejects(missing.verify(), /MIGRATION_JOURNAL_INVENTORY_MISMATCH/);
  assert.equal(missing.transport.observations.sent, 0);
  const invalidReference = await managedFixture();
  invalidReference.reference.tables.push({ name: 'schema_migrations', columns: ['id'], rows: [] });
  await assert.rejects(invalidReference.verify(), /REFERENCE_TABLE_NOT_APPLICATION_TABLE/);
  assert.equal(invalidReference.transport.observations.sent, 0);
});

test('CLI refuses env loading before any Keychain/network access and plan has no side effects', () => {
  const run = (args: string[], disabled: boolean) => spawnSync(process.execPath,
    ['--import', 'tsx', 'src/scripts/productionManagedIntegration.ts', ...args], {
      env: { PATH: process.env.PATH, ENV_FILE_LOADING: disabled ? 'disabled' : 'enabled' }, encoding: 'utf8', timeout: 10000,
    });
  const rejected = run(['check', '--confirm-project', INTEGRATION_PROJECT], false);
  assert.equal(rejected.status, 1); assert.match(rejected.stderr, /ENV_FILE_LOADING_MUST_BE_DISABLED/);
  assert.doesNotMatch(rejected.stdout, /KEYCHAIN/);
  const plan = run(['plan'], true);
  assert.equal(plan.status, 0);
  assert.equal(JSON.parse(plan.stdout).networkAccessed, false);
  assert.equal(JSON.parse(plan.stdout).productionChanged, false);
  assert.equal(JSON.parse(plan.stdout).applicationTables, 68);
  assert.deepEqual(JSON.parse(plan.stdout).privateMigrationJournals.sort(), [...PRIVATE_JOURNALS].sort());
});

test('live harness never listens, starts workers, bootstraps accounts or weakens shared middleware', async () => {
  const source = await readFile('src/scripts/productionManagedIntegration.ts', 'utf8');
  assert.doesNotMatch(source, /\.listen\(|\.startWorkers\(|bootstrapFirstTeacher\(/);
  assert.match(source, /globalThis.fetch = transport.fetch/);
  assert.match(source, /fullApplicationAcceptancePassed: false/);
  assert.match(source, /loginAndMutationFlowsTested: false/);
});
