import assert from 'node:assert/strict';
import test from 'node:test';
import type { WriterSession } from './reconciliationWriterCatalog.js';
import { readStudentPhotoSql, requireStudentPhotoAbsent, requireStudentPhotoFunction, STUDENT_PHOTO_CHANGE,
  STUDENT_PHOTO_SIGNATURE, STUDENT_PHOTO_SQL_SHA256, studentPhotoHash, validateStudentPhotoReceipt,
  withoutStudentPhotoCatalog, withoutStudentPhotoSession } from './studentPhotoProductionPolicy.js';
import { runStudentPhotoProduction } from './studentPhotoProductionCli.js';
import pg from 'pg';
import { photoMetadata } from './studentPhotoProductionFixtures.js';
function session(rows: Record<string, unknown>[]): WriterSession {
  return { inventory: async () => ({ tables: [], structure: [], roles: [], extensions: [] }), query: async () => ({ rows }) };
}
test('fixed repository SQL is pinned and executable attributes/ACL are all checked', async () => {
  const sql = await readStudentPhotoSql(), metadata = photoMetadata(sql);
  assert.equal(studentPhotoHash(sql), STUDENT_PHOTO_SQL_SHA256);
  await requireStudentPhotoFunction(session([metadata]), sql);
  const mutations = [{ body: 'BEGIN RETURN NULL; END;' }, { definer: true }, { config: ['search_path=public'] },
    { owner: 'service_role' }, { language: 'sql' }, { kind: 'p' }, { volatility: 's' }, { strict: true },
    { leakproof: true }, { parallel: 's' }, { returns_set: true }, { result: 'text' }, { defaults: 1 },
    { cost: 1 }, { result_rows: 1000 }, { support: 'other' }, { binary: 'other' }, { sql_body: 'other' },
    { variadic: 25 }, { transforms: '23' }, { extension_owned: true }, { argument_names: [] }, { argument_modes: ['o'] },
    { overloads: 2 }, { anon_execute: true }, { authenticated_execute: true }, { service_execute: false },
    { acl: [] }, { acl: null }, { acl: [null, null] },
    { acl: [...metadata.acl as object[], { grantee: 'PUBLIC', privilege: 'EXECUTE' }] },
    { acl: ['postgres', 'service_role'].map(grantee => ({ grantee, grantor: 'postgres', privilege: 'EXECUTE', grantable: true })) }];
  for (const change of mutations) await assert.rejects(requireStudentPhotoFunction(session([{ ...metadata, ...change }]), sql));
  await assert.rejects(requireStudentPhotoFunction(session([]), sql));
  await assert.rejects(requireStudentPhotoFunction(session([metadata]), sql + '\n'));
  await assert.rejects(requireStudentPhotoFunction(session([metadata, metadata]), sql));
});
test('present RPC, overload or unknown absence result refuses retry', async () => {
  await requireStudentPhotoAbsent(session([{ count: 0 }]));
  for (const rows of [[], [{ count: 1 }], [{ count: '0' }], [{ count: 0 }, { count: 0 }]]) {
    await assert.rejects(requireStudentPhotoAbsent(session(rows)));
  }
});
test('internal Adapter removes exactly one named addition; unrelated objects/security remain visible', async () => {
  const target = { kind: 'function', name: STUDENT_PHOTO_SIGNATURE, definition: 'approved fixture' };
  const other = { ...target, name: 'other_rpc()' };
  const inventory = { tables: [], structure: [target, other], roles: [], extensions: [] };
  const catalog = { inventory, security: [target, other] };
  const stripped = withoutStudentPhotoCatalog(catalog);
  assert.deepEqual(stripped.inventory.structure, [other]); assert.deepEqual(stripped.security, [other]);
  assert.equal(catalog.inventory.structure.length, 2);
  const db = withoutStudentPhotoSession({ inventory: async () => inventory, query: async () => ({ rows: catalog.security }) });
  assert.deepEqual((await db.inventory()).structure, [other]);
  assert.deepEqual((await db.query('SELECT kind,name,metadata')).rows, [other]);
  assert.deepEqual((await db.query('SELECT unrelated')).rows, catalog.security);
});
test('receipt is exact, operation/checksum-bound and never accepts future or extra fields', () => {
  const now = '2026-10-19T14:00:00.000Z';
  const receipt = { operation: STUDENT_PHOTO_CHANGE, sqlSha256: STUDENT_PHOTO_SQL_SHA256, releaseSha: '1'.repeat(40),
    approvalSha256: 'a'.repeat(64), baselineEvidenceSha256: 'b'.repeat(64), rehearsalSha256: 'e'.repeat(64), beforeCatalogSha256: 'c'.repeat(64),
    afterCatalogSha256: 'd'.repeat(64), appliedAt: now };
  validateStudentPhotoReceipt(receipt, receipt.afterCatalogSha256, now);
  for (const change of [{ operation: 'generic-sql' }, { sqlSha256: '0'.repeat(64) }, { releaseSha: 'main' },
    { approvalSha256: '' }, { beforeCatalogSha256: receipt.afterCatalogSha256 }, { afterCatalogSha256: 'e'.repeat(64) },
    { appliedAt: '2026-10-19T14:00:00.001Z' }, { appliedAt: 'invalid' }, { appliedAt: '2026-10-19T14:00:00Z' }, { force: true }]) {
    assert.throws(() => validateStudentPhotoReceipt({ ...receipt, ...change }, receipt.afterCatalogSha256, now));
  }
});
test('plan and malformed CLI never connect to database or create approvals', async t => {
  let connections = 0;
  t.mock.method(pg.Client.prototype, 'connect', async () => { connections++; throw new Error('FORBIDDEN'); });
  const output: string[] = []; t.mock.method(console, 'log', (value: string) => { output.push(value); });
  await runStudentPhotoProduction(['plan']);
  assert.equal(JSON.parse(output[0]).approvalCreated, false);
  for (const args of [[], ['apply'], ['inspect'], ['apply', '--force', 'true'], ['plan', '--apply', 'true']]) {
    await assert.rejects(runStudentPhotoProduction(args));
  }
  assert.equal(connections, 0);
});
