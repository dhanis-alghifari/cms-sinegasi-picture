import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fixtureJwt, parseApiEvidence, POSTGREST_FIXTURE_SECRET, POSTGREST_REHEARSAL_IMAGE,
  requireApiRehearsalArguments, requireIsolatedApiTarget } from './productionApiRehearsalCore.js';

test('API rehearsal accepts only explicit isolated mode and loopback disposable target', () => {
  requireApiRehearsalArguments(['rehearse-api']); requireIsolatedApiTarget('127.0.0.1', 'sinegasi_schema_fresh');
  for (const args of [[], ['apply'], ['rehearse-api', '--production'], ['postgres']]) assert.throws(() => requireApiRehearsalArguments(args));
  for (const [host, db] of [['127.0.0.1', 'postgres'], ['db.pvbdiftvzoeelibxlxzb.supabase.co', 'sinegasi_schema_fresh']]) {
    assert.throws(() => requireIsolatedApiTarget(host, db));
  }
});
test('synthetic JWT role and HMAC are valid without using any live secret', () => {
  for (const role of ['service_role', 'anon', 'authenticated'] as const) {
    const [header, payload, signature] = fixtureJwt(role).split('.');
    assert.equal(JSON.parse(Buffer.from(payload, 'base64url').toString()).role, role);
    assert.equal(signature, createHmac('sha256', POSTGREST_FIXTURE_SECRET).update(`${header}.${payload}`).digest('base64url'));
  }
});
test('receipt rejects missing checks, wrong checksum, failed tests or claimed production approval', () => {
  const valid = { status: 'ISOLATED_APPLICATION_API_REHEARSAL_PASSED', schemaPackageSha256: 'schema', referenceChecksum: 'ref',
    isolatedApplicationFlowTestsPassed: true, productionChanged: false, devDatabaseChanged: false,
    managedSupabaseIntegrationTested: false, productionApproved: false, liveAccountCreated: false, checks: Array.from({ length: 15 }, (_, i) => `check-${i}`) };
  assert.equal(parseApiEvidence(JSON.stringify(valid), 'schema', 'ref').status, valid.status);
  for (const change of [{ status: 'FAILED' }, { checks: [] }, { checks: Array(15).fill(true) }, { schemaPackageSha256: 'changed' },
    { isolatedApplicationFlowTestsPassed: false }, { productionChanged: true }, { productionApproved: true }, { managedSupabaseIntegrationTested: true }]) {
    assert.throws(() => parseApiEvidence(JSON.stringify({ ...valid, ...change }), 'schema', 'ref'));
  }
});
test('VPS API script pins image, denies host ports, bounds resources and keeps TLS verification', async () => {
  const shell = await readFile('../ops/rehearse-production-api-vps.sh', 'utf8');
  assert.ok(shell.includes(POSTGREST_REHEARSAL_IMAGE));
  assert.match(shell, /--read-only/); assert.match(shell, /--cap-drop ALL/);
  assert.match(shell, /--memory 128m --memory-swap 128m/); assert.match(shell, /--memory 256m --memory-swap 256m/);
  assert.match(shell, /--network "container:\$pg_id"/); assert.doesNotMatch(shell, /--publish|--network host|NODE_TLS_REJECT_UNAUTHORIZED/);
  assert.match(shell, /NODE_EXTRA_CA_CERTS=/); assert.match(shell, /owned_pg/);
});
