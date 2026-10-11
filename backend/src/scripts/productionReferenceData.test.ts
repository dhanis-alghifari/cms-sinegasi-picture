import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { before, test } from 'node:test';
import { CAPABILITY_VALUES, ROLE_CAPABILITIES } from '../middleware/capabilities.js';
import { verifyCandidateFiles } from './productionReconciliation.js';
import {
  createReferenceDataPlan, parseReferencePlanArguments, rehearseReferenceData, ReferenceDataError,
  type ReferenceDatabase, type ReferenceDataPlan,
} from './productionReferenceData.js';

let candidate: Awaited<ReturnType<typeof verifyCandidateFiles>>;
let plan: ReferenceDataPlan;
before(async () => {
  candidate = await verifyCandidateFiles(resolve(__dirname, '../../..'));
  plan = createReferenceDataPlan(candidate.snapshot, candidate.fingerprint, 5000);
});
type Row = Record<string, unknown>;

/** Stateful transaction fixture. It tests orchestration, not PostgreSQL syntax/managed Supabase. */
class MemoryReferenceDatabase implements ReferenceDatabase {
  readonly queries: Array<{ sql: string; values?: readonly unknown[] }> = [];
  database = 'sinegasi_schema_fresh';
  actor = 'postgres';
  acquired = true;
  inventory = candidate.snapshot.tables.map(table => ({ name: table.relname, rls: true }));
  tables: Record<string, Row[]> = Object.fromEntries(candidate.snapshot.tables.map(table => [table.relname, []]));
  historyExists = false;
  receipt: string | undefined;
  failOn: string | undefined;
  failRollback = false;
  private before: { tables: Record<string, Row[]>; historyExists: boolean; receipt: string | undefined } | undefined;

  async query(sql: string, values?: readonly unknown[]) {
    this.queries.push({ sql, values });
    if (this.failOn && sql.includes(this.failOn)) throw new Error('PRIVATE_DATABASE_ERROR_MUST_NOT_ESCAPE');
    if (sql === 'BEGIN') {
      this.before = { tables: structuredClone(this.tables), historyExists: this.historyExists, receipt: this.receipt };
    } else if (sql === 'ROLLBACK') {
      if (this.failRollback) throw new Error('PRIVATE_ROLLBACK_ERROR');
      if (this.before) {
        this.tables = this.before.tables; this.historyExists = this.before.historyExists; this.receipt = this.before.receipt;
      }
    } else if (sql.includes('current_database()')) return { rows: [{ database: this.database, actor: this.actor }] };
    else if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: this.acquired }] };
    else if (sql.includes('FROM pg_class')) return { rows: this.inventory };
    else if (sql.includes('to_regclass(')) return { rows: [{ exists: this.historyExists }] };
    else if (sql.startsWith('SELECT checksum FROM sinegasi_ops.')) return { rows: this.receipt ? [{ checksum: this.receipt }] : [] };
    else if (sql.startsWith('CREATE SCHEMA')) this.historyExists = true;
    else if (sql.startsWith('INSERT INTO sinegasi_ops.')) this.receipt = String(values?.[1]);
    else {
      const table = /public\."([a-z_]+)"/.exec(sql)?.[1];
      if (table && sql.startsWith('SELECT EXISTS')) return { rows: [{ nonempty: this.tables[table].length > 0 }] };
      if (table && sql.startsWith('SELECT ')) return { rows: this.tables[table] };
      if (table && sql.startsWith('INSERT INTO public.')) {
        const columns = plan.tables.find(item => item.name === table)?.columns;
        assert.ok(columns); assert.ok(values);
        this.tables[table].push(Object.fromEntries(columns.map((column, index) => [column, values[index]])));
      }
    }
    return { rows: [] };
  }
}
function run(db: MemoryReferenceDatabase, confirmedChecksum = plan.checksum) {
  return rehearseReferenceData(db, candidate.snapshot, candidate.fingerprint, 5000, confirmedChecksum);
}
function writes(db: MemoryReferenceDatabase) {
  return db.queries.filter(query => /^(INSERT|UPDATE|DELETE|CREATE|REVOKE|ALTER|DROP)\b/.test(query.sql));
}

test('reference configuration equals current authorization contract; no DEV accounts, sample records or QRIS', () => {
  assert.equal(plan.tables.length, 6);
  const roles = plan.tables.find(table => table.name === 'access_roles')!;
  const permissions = plan.tables.find(table => table.name === 'access_permissions')!;
  const assignments = plan.tables.find(table => table.name === 'access_role_permissions')!;
  assert.equal(roles.rows.length, 9);
  assert.deepEqual(permissions.rows.map(row => row[0]), [...CAPABILITY_VALUES]);
  for (const [role, capabilities] of Object.entries(ROLE_CAPABILITIES)) {
    assert.deepEqual(assignments.rows.filter(row => row[0] === role).map(row => row[1]), [...capabilities]);
  }
  assert.ok(!assignments.rows.some(row => row[0] === 'member' && row[1] === 'users.manage'));
  assert.ok(!assignments.rows.some(row => row[0] === 'social_media_team' && row[1] === 'social_media.accounts.manage'));
  assert.deepEqual(plan.tables.find(table => table.name === 'cash_settings')?.rows, [[true, 5000, null, null, true, null, null]]);
  assert.deepEqual(plan.tables.find(table => table.name === 'cash_payment_methods')?.rows, [['cash', 'Cash', true, 10, null, null]]);
  assert.equal(plan.tables.find(table => table.name === 'work_types')?.rows.length, 8);
  assert.equal(plan.tables.some(table => ['users', 'students', 'classes', 'cash_transactions', 'schema_migrations'].includes(table.name)), false);
});
test('fee is never silently inferred; checksums bind schema, exact rows, authorization and fee', () => {
  const noFee = createReferenceDataPlan(candidate.snapshot, candidate.fingerprint);
  assert.equal(noFee.billingAmount, null);
  assert.deepEqual(noFee.tables.find(table => table.name === 'cash_settings')?.rows, []);
  assert.notEqual(plan.checksum, noFee.checksum);
  assert.notEqual(plan.checksum, createReferenceDataPlan(candidate.snapshot, candidate.fingerprint, 6000).checksum);
  assert.notEqual(plan.checksum, createReferenceDataPlan(candidate.snapshot, 'a'.repeat(64), 5000).checksum);
  assert.deepEqual(plan, createReferenceDataPlan(candidate.snapshot, candidate.fingerprint, 5000));
  for (const amount of [0, 499, -500, NaN, Infinity, 500.5, 10_000_000_000]) {
    assert.throws(() => createReferenceDataPlan(candidate.snapshot, candidate.fingerprint, amount), ReferenceDataError);
  }
});
test('changed enum or required configuration columns fail planning', () => {
  const snapshot = structuredClone(candidate.snapshot);
  snapshot.enums.find(item => item.name === 'user_role')!.labels.push('root');
  assert.throws(() => createReferenceDataPlan(snapshot, candidate.fingerprint, 5000), { code: 'REFERENCE_ROLE_SCHEMA_MISMATCH' });
  const missing = structuredClone(candidate.snapshot);
  missing.tables.find(item => item.relname === 'cash_settings')!.columns = missing.tables.find(item => item.relname === 'cash_settings')!.columns.filter(column => column.name !== 'skip_week');
  assert.throws(() => createReferenceDataPlan(missing, candidate.fingerprint, 5000), { code: 'REFERENCE_TABLE_SCHEMA_MISMATCH' });
});
test('checksum and fee approval are checked before any database query', async () => {
  const db = new MemoryReferenceDatabase();
  await assert.rejects(run(db, 'a'.repeat(64)), { code: 'REFERENCE_APPROVAL_CHECKSUM_MISMATCH' });
  await assert.rejects(rehearseReferenceData(db, candidate.snapshot, candidate.fingerprint, null as unknown as number, plan.checksum),
    { code: 'REFERENCE_BILLING_AMOUNT_REQUIRED' });
  assert.equal(db.queries.length, 0);
});
test('production/dev postgres, unknown database and non-admin actor are refused before any writes', async () => {
  for (const identity of [{ database: 'postgres', actor: 'postgres' }, { database: 'other', actor: 'postgres' },
    { database: 'sinegasi_schema_fresh', actor: 'service_role' }]) {
    const db = new MemoryReferenceDatabase(); Object.assign(db, identity);
    await assert.rejects(run(db), { code: 'REFERENCE_ISOLATED_DATABASE_REQUIRED' });
    assert.equal(writes(db).length, 0);
    assert.equal(db.queries.at(-1)?.sql, 'ROLLBACK');
  }
});
test('concurrent runner, missing/unknown tables and disabled RLS fail closed', async () => {
  for (const mutate of [
    (db: MemoryReferenceDatabase) => { db.acquired = false; },
    (db: MemoryReferenceDatabase) => { db.inventory.pop(); },
    (db: MemoryReferenceDatabase) => { db.inventory[0].rls = false; },
    (db: MemoryReferenceDatabase) => { db.inventory[0].name = 'unknown'; },
  ]) {
    const db = new MemoryReferenceDatabase(); mutate(db);
    await assert.rejects(run(db), ReferenceDataError);
    assert.equal(writes(db).length, 0);
  }
});
test('first run refuses partial configuration, business rows and copied historical receipts without upserting', async () => {
  for (const table of ['users', 'students', 'cash_transactions', 'schema_migrations', 'access_roles', 'cash_settings']) {
    const db = new MemoryReferenceDatabase(); db.tables[table] = [{ existing: true }];
    await assert.rejects(run(db), { code: 'REFERENCE_NONEMPTY_DATABASE_REFUSED' });
    assert.equal(writes(db).length, 0);
    assert.deepEqual(db.tables[table], [{ existing: true }]);
  }
});
test('all reference rows and private receipt commit together; repeat verifies exact data and is no-op', async () => {
  const db = new MemoryReferenceDatabase();
  const result = await run(db);
  assert.equal(result.mode, 'applied');
  assert.equal(result.referenceRows, plan.tables.reduce((sum, table) => sum + table.rows.length, 0));
  assert.equal(db.receipt, plan.checksum);
  assert.equal(db.tables.users.length, 0);
  assert.equal(db.tables.schema_migrations.length, 0);
  assert.equal(db.queries.at(-1)?.sql, 'COMMIT');
  assert.match(db.queries.find(query => query.sql.startsWith('REVOKE') || query.sql.startsWith('CREATE SCHEMA'))!.sql,
    /REVOKE ALL ON sinegasi_ops.reference_data_history FROM PUBLIC,anon,authenticated,service_role/);
  for (const insert of db.queries.filter(query => query.sql.startsWith('INSERT INTO public.'))) {
    assert.ok(insert.values?.length);
    assert.doesNotMatch(insert.sql, /ON CONFLICT|5000|Film Pendek|Cash|users\.manage/);
  }
  const initialWrites = writes(db).length;
  assert.equal((await run(db)).mode, 'noop');
  assert.equal(writes(db).length, initialWrites);
});
test('matching receipt does not hide changed/missing/extra data, unknown receipt or later business rows', async () => {
  for (const mutate of [
    (db: MemoryReferenceDatabase) => { db.receipt = 'f'.repeat(64); },
    (db: MemoryReferenceDatabase) => { db.tables.work_types[0].is_active = false; },
    (db: MemoryReferenceDatabase) => { db.tables.access_role_permissions.pop(); },
    (db: MemoryReferenceDatabase) => { db.tables.access_roles.push({ role_key: 'root', label: 'Root' }); },
    (db: MemoryReferenceDatabase) => { db.tables.users.push({ username: 'admin' }); },
  ]) {
    const db = new MemoryReferenceDatabase(); await run(db); mutate(db);
    const initialWrites = writes(db).length;
    await assert.rejects(run(db), ReferenceDataError);
    assert.equal(writes(db).length, initialWrites);
  }
});
test('row or receipt failure rolls back all configuration and sanitizes diagnostics', async () => {
  for (const failOn of ['INSERT INTO public."work_types"', 'INSERT INTO sinegasi_ops.reference_data_history']) {
    const db = new MemoryReferenceDatabase(); db.failOn = failOn;
    await assert.rejects(run(db), { code: 'REFERENCE_REHEARSAL_FAILED', message: 'REFERENCE_REHEARSAL_FAILED' });
    assert.equal(Object.values(db.tables).flat().length, 0);
    assert.equal(db.receipt, undefined);
    assert.equal(db.historyExists, false);
    assert.equal(db.queries.at(-1)?.sql, 'ROLLBACK');
  }
});
test('lost commit acknowledgement is marked uncertain; no automatic retry or secret diagnostic', async () => {
  const db = new MemoryReferenceDatabase(); db.failOn = 'COMMIT'; db.failRollback = true;
  await assert.rejects(run(db), { code: 'REFERENCE_COMMIT_UNCERTAIN_INSPECT_BEFORE_RETRY' });
  assert.equal(db.queries.filter(query => query.sql === 'BEGIN').length, 1);
});
test('CLI accepts offline planning only and rejects apply, URLs, extra flags and malformed amounts', () => {
  assert.equal(parseReferencePlanArguments(['plan']), null);
  assert.equal(parseReferencePlanArguments(['plan', '--billing-amount', '5000']), 5000);
  for (const args of [[], ['apply'], ['plan', '--project-ref', 'pvbdiftvzoeelibxlxzb'],
    ['plan', '--billing-amount', '499'], ['plan', '--billing-amount', '5e3'], ['plan', '--billing-amount', '5000.50'],
    ['plan', '--billing-amount', '5000', '--apply'], ['plan', '--billing-amount', 'postgres://secret']]) {
    assert.throws(() => parseReferencePlanArguments(args), ReferenceDataError);
  }
});
