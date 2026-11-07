import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { optionalFieldsBaseline, optionalFieldsBaselineSession, requireOptionalFieldsProductionHistory } from './optionalFieldsProductionPolicy.js';
import { loadSnapshot } from './productionReconciliation.js';
import { writerCatalogHash, type WriterCatalog, type WriterSession } from './reconciliationWriterCatalog.js';

const fixturePath = resolve(__dirname, 'fixtures/optional-fields-catalog.json');
const repository = resolve(__dirname, '../../..');

async function fixture(): Promise<WriterCatalog> {
  const value = JSON.parse(await readFile(fixturePath, 'utf8')) as Pick<WriterCatalog, 'security'> & { structure: Record<string, unknown>[] };
  return { inventory: { tables: [], structure: value.structure, roles: [], extensions: [] }, security: value.security };
}

test('optional-fields baseline removes exactly the reviewed deltas', async () => {
  const catalog = await fixture(), snapshot = await loadSnapshot(repository);
  const baseline = optionalFieldsBaseline(catalog, snapshot);
  assert.equal(baseline.inventory.structure.length, catalog.inventory.structure.length - 1);
  assert.equal(baseline.security.length, 0);
  for (const name of ['students.nis', 'contests.tanggal_lomba']) {
    const row = baseline.inventory.structure.find(item => item.name === name);
    assert.equal((JSON.parse(String(row?.definition)) as { notNull: boolean }).notNull, true);
  }
});

test('changed RPC ACL, body, string literal and required nullability are refused', async () => {
  const snapshot = await loadSnapshot(repository);
  for (const mutation of [
    (c: WriterCatalog) => { c.security[0].metadata = String(c.security[0].metadata).replace('service_role=X/postgres', 'anon=X/postgres'); },
    (c: WriterCatalog) => { c.security[0].metadata = String(c.security[0].metadata).replace('postgres=X/postgres', 'postgres=X*/postgres'); },
    (c: WriterCatalog) => { const f = c.inventory.structure.find(r => r.name === 'validate_contest_deadline_future()')!; f.definition = String(f.definition).replace("'Asia/Jakarta'", "'Asia/Makassar'"); },
    (c: WriterCatalog) => { const f = c.inventory.structure.find(r => r.name === 'validate_contest_deadline_future()')!; f.definition = String(f.definition).replace('v_validate := true', 'v_validate := false'); },
    (c: WriterCatalog) => { const col = c.inventory.structure.find(r => r.name === 'students.nis')!; col.definition = String(col.definition).replace('"notNull": false', '"notNull": true'); },
    (c: WriterCatalog) => { c.security = [...c.security, c.security[0]]; },
  ]) {
    const catalog = await fixture(); mutation(catalog);
    assert.throws(() => optionalFieldsBaseline(catalog, snapshot));
  }
});

test('unreviewed column and unrelated ACL are retained for the complete catalog hash', async () => {
  const snapshot = await loadSnapshot(repository), catalog = await fixture();
  catalog.inventory.structure.push({ kind: 'column', name: 'other.sensitive', definition: '{"notNull": true}' });
  catalog.security = [...catalog.security, { kind: 'relation', name: 'other', metadata: '{"acl":[]}' }];
  const expected = writerCatalogHash(optionalFieldsBaseline(catalog, snapshot));
  catalog.inventory.structure.at(-1)!.definition = '{"notNull": false}';
  assert.notEqual(writerCatalogHash(optionalFieldsBaseline(catalog, snapshot)), expected);
  catalog.inventory.structure.at(-1)!.definition = '{"notNull": true}';
  catalog.security.at(-1)!.metadata = '{"acl":["anon=r/postgres"]}';
  assert.notEqual(writerCatalogHash(optionalFieldsBaseline(catalog, snapshot)), expected);
});

test('production history requires its exact observed IDs and never accepts DEV IDs', async () => {
  const valid = [{ version: '20261106141216', name: 'student_optional_nis' },
    { version: '20261107034531', name: 'contest_optional_deadline_emergency' }];
  for (const rows of [valid, [], [valid[0]], [{ ...valid[0], version: '20261106140055' },
    { ...valid[1], version: '20261106145222' }], [...valid, valid[1]]]) {
    const queries: string[] = [];
    const db: WriterSession = { inventory: async () => (await fixture()).inventory,
      async query(sql) { queries.push(sql); return { rows }; } };
    if (rows === valid) await requireOptionalFieldsProductionHistory(db);
    else await assert.rejects(requireOptionalFieldsProductionHistory(db));
    assert.equal(queries.length, 1); assert.match(queries[0], /^SELECT /);
  }
});

test('baseline session passes privilege and reference queries through unchanged', async () => {
  const catalog = await fixture(), snapshot = await loadSnapshot(repository);
  const baseline = optionalFieldsBaseline(catalog, snapshot);
  const queries: string[] = [], original = [{ unchanged: true }];
  const db: WriterSession = { inventory: async () => catalog.inventory,
    async query(sql) { queries.push(sql); return { rows: original }; } };
  const normalized = optionalFieldsBaselineSession(db, baseline, snapshot);
  assert.deepEqual(await normalized.query('SELECT has_function_privilege(...)'), { rows: original });
  assert.deepEqual(await normalized.query('SELECT * FROM public."cash_payment_methods"'), { rows: original });
  assert.deepEqual(queries, ['SELECT has_function_privilege(...)', 'SELECT * FROM public."cash_payment_methods"']);
});
