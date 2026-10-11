import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { canonicalConstraintDefinition, compileReconciliation, loadSnapshot, validateSnapshot, verifyCandidateFiles } from './productionReconciliation.js';
import { splitSqlStatements } from './migrationSafety.js';

test('candidate contains all schema objects but no top-level business/demo/history DML', async () => {
  await verifyCandidateFiles(resolve(__dirname, '../../..'));
  const snapshot = await loadSnapshot(resolve(__dirname, '../../..'));
  const [enums, schema] = compileReconciliation(snapshot);
  assert.equal(snapshot.tables.length, 73);
  assert.equal(snapshot.legacyTables.length, 17);
  assert.equal(snapshot.functions.length, 111);
  for (const sql of [enums, schema]) {
    assert.match(sql, /ISOLATED_REHEARSAL_DATABASE_REQUIRED/);
    for (const statement of splitSqlStatements(sql)) {
      const head = statement.replace(/^(\s*--[^\n]*\n)*/,'').trim();
      assert.doesNotMatch(head, /^(INSERT|UPDATE|DELETE|TRUNCATE|DROP TABLE|DROP SCHEMA|COPY|GRANT.*TO PUBLIC|ALTER SYSTEM)\b/i);
      assert.doesNotMatch(head, /\bDROP\b[^;]*\bCASCADE\b/i);
    }
  }
  assert.match(schema, /NONEMPTY_DATABASE_REFUSED/);
  assert.match(schema, /REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated/);
  assert.match(schema, /security_invoker=true/);
  assert.doesNotMatch(schema, /GRANT [^;]*ON public\."schema_migrations"/);
  assert.doesNotMatch(enums, /CREATE TABLE/);
  for(const table of snapshot.tables) assert.ok(schema.includes(`ALTER TABLE public."${table.relname}" ENABLE ROW LEVEL SECURITY;`));
  assert.equal(snapshot.tables.filter(t=>!t.relrowsecurity).length,1);
});
test('deparser allowance applies only to one exact associative AND check, never changed semantics',async()=>{
  const s=await loadSnapshot(resolve(__dirname,'../../..'));
  const c=s.constraints.find(c=>c.table==='borrowing_return_evidence' && c.name==='borrowing_return_evidence_key_check');
  assert.ok(c);
  const name=c.table+'.'+c.name;
  assert.notEqual(canonicalConstraintDefinition(name,c.definition),c.definition);
  assert.equal(canonicalConstraintDefinition('other.'+c.name,c.definition),c.definition);
  const changed=c.definition.replace('<= 1024','<= 2048');
  assert.equal(canonicalConstraintDefinition(name,changed),changed);
  const or=c.definition.replace(' AND ',' OR ');
  assert.equal(canonicalConstraintDefinition(name,or),or);
});
test('changed legacy columns, identities and sequences refuse compilation', async () => {
  const snapshot = await loadSnapshot(resolve(__dirname, '../../..'));
  for (const mutate of [
    (s: typeof snapshot) => { s.legacyTables[0].columns[0].type = 'integer'; },
    (s: typeof snapshot) => { s.tables[0].columns[0].identity = 'a'; },
    (s: typeof snapshot) => { s.sequences.push({ name: 'unknown' }); },
    (s: typeof snapshot) => { s.tables.push(s.tables[0]); },
  ]) {
    const modified = structuredClone(snapshot); mutate(modified);
    assert.throws(() => validateSnapshot(modified));
  }
});
