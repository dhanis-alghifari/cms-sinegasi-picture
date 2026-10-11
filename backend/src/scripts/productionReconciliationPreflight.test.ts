import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import type { DatabaseInventory } from './productionBackupCore.js';
import { loadPreflightPlan, requirePreflightMode, requireReadOnlyProductionIdentity, validateLegacyInventory, validatePreflightEvidence } from './productionReconciliationPreflightCore.js';
import { loadSnapshot, verifyCandidateFiles } from './productionReconciliation.js';

const repository = resolve(__dirname, '../../..');
async function receipts(): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const file of ['production-reconciliation.fresh-rehearsal.json', 'production-reconciliation.rehearsal.json',
    'production-reference-data.rehearsal.json', 'production-api.rehearsal.json']) {
    result[file] = JSON.parse(await readFile(resolve(repository, 'ops', file), 'utf8')) as unknown;
  }
  return result;
}
test('preflight binds real schema/config/API receipts, never grants permission to apply', async () => {
  const { plan } = await loadPreflightPlan(repository);
  assert.equal(plan.targetTables, 73); assert.equal(plan.expectedLegacyTables, 17);
  assert.equal(plan.apiChecks, 21); assert.equal(plan.referenceRows, 213);
  assert.equal(plan.billingAmount, 5000); assert.equal(plan.applyAvailable, false);
  assert.equal(plan.productionApproved, false); assert.equal(plan.productionChanged, false);
  assert.equal(Object.keys(plan.evidenceSha256).length, 4);
});
test('unknown modes including apply/reset/db push are refused', () => {
  assert.equal(requirePreflightMode(['plan']), 'plan');
  assert.equal(requirePreflightMode(['preflight']), 'preflight');
  for (const args of [[], ['apply'], ['reset'], ['db', 'push'], ['preflight', '--force']]) assert.throws(() => requirePreflightMode(args));
});
test('only production postgres identity in an actual read-only PG17 transaction is accepted', () => {
  const valid = { database: 'postgres', actor: 'postgres', readOnly: 'on', version: '17.6' };
  assert.equal(requireReadOnlyProductionIdentity(valid), '17.6');
  for (const override of [{ database: 'dev' }, { actor: 'service_role' }, { readOnly: 'off' }, { version: '16.1' }]) {
    assert.throws(() => requireReadOnlyProductionIdentity({ ...valid, ...override }));
  }
});
test('tampered, incomplete, duplicate or promoted evidence fails closed', async () => {
  const { snapshot, fingerprint } = await verifyCandidateFiles(repository);
  const source = await receipts();
  const apiFile = 'production-api.rehearsal.json';
  for (const mutate of [
    (r: Record<string, unknown>) => { (r[apiFile] as Record<string, unknown>).cleanupVerified = false; },
    (r: Record<string, unknown>) => { (r[apiFile] as Record<string, unknown>).schemaPackageSha256 = '0'.repeat(64); },
    (r: Record<string, unknown>) => { (r[apiFile] as Record<string, unknown>).productionApproved = true; },
    (r: Record<string, unknown>) => { (r[apiFile] as Record<string, unknown>).checks = Array(21).fill('NO_TOKEN_REJECTED'); },
    (r: Record<string, unknown>) => { (r['production-reconciliation.rehearsal.json'] as Record<string, unknown>).checks = {}; },
    (r: Record<string, unknown>) => { (r['production-reference-data.rehearsal.json'] as Record<string, unknown>).referenceRows = 212; },
  ]) {
    const modified = structuredClone(source); mutate(modified);
    assert.throws(() => validatePreflightEvidence(snapshot, fingerprint, modified));
  }
});
test('baseline requires all 17 tables empty with exact columns and RLS, never only zero users', async () => {
  const snapshot = await loadSnapshot(repository);
  const valid: DatabaseInventory = {
    tables: snapshot.legacyTables.map(t => ({ schema: 'public', name: t.relname, rows: '0', rls: t.relrowsecurity, forceRls: false })),
    structure: snapshot.legacyTables.flatMap(t => t.columns.map(c => ({ kind: 'column', name: `${t.relname}.${c.name}`,
      definition: JSON.stringify({ type: c.type, notNull: c.notNull, default: c.default, identity: c.identity, generated: '' }) }))),
    roles: [], extensions: [],
  };
  assert.equal(validateLegacyInventory(valid, snapshot).totalPublicRows, 0);
  for (const mutate of [
    (i: DatabaseInventory) => { i.tables[0].rows = '1'; },
    (i: DatabaseInventory) => { i.tables[0].name = 'unknown'; },
    (i: DatabaseInventory) => { i.tables[0].rls = !i.tables[0].rls; },
    (i: DatabaseInventory) => { i.structure.pop(); },
    (i: DatabaseInventory) => { i.structure[0].definition = JSON.stringify({ type: 'integer', generated: '' }); },
  ]) {
    const modified = structuredClone(valid); mutate(modified);
    assert.throws(() => validateLegacyInventory(modified, snapshot));
  }
});
test('CLI contains read-only transaction/TLS checks and no database write path or env loading', async () => {
  const source = await readFile(resolve(__dirname, 'productionReconciliationPreflight.ts'), 'utf8');
  assert.match(source, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(source, /default_transaction_read_only=on/);
  assert.match(source, /rejectUnauthorized: true/);
  assert.match(source, /O_EXCL \| constants.O_NOFOLLOW/);
  assert.doesNotMatch(source, /from ['"][^'"]*(?:dotenv|config\/env)|INSERT INTO|CREATE SCHEMA|ALTER TABLE|DROP TABLE|TRUNCATE|COMMIT/);
});
