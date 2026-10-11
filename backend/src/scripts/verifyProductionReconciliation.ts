import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { databaseInventory, quoteIdentifier } from './productionBackupCore.js';
import { canonicalConstraintDefinition, compileReconciliation, RECONCILIATION_FILES, sha256, validateSnapshot, type SchemaSnapshot } from './productionReconciliation.js';

const directory = __dirname;
const history = 'sinegasi_ops.reconciliation_history';
let stage = 'INITIALIZATION';
let diagnostic: {code?:string;position?:string} = {};
let catalogDiagnostic: unknown;
function client(database: string): pg.Client {
  if (!['sinegasi_backup_restore','sinegasi_schema_fresh'].includes(database)) throw new Error('ISOLATED_DATABASE_REQUIRED');
  const db = new pg.Client({ host:'127.0.0.1', port:5432, user:'postgres', database,
    connectionTimeoutMillis:3000, query_timeout:30000 });
  db.on('error', () => {}); return db;
}
async function apply(db: pg.Client, name: string, sql: string): Promise<boolean> {
  const checksum = sha256(sql);
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='25s'");
    await db.query('CREATE SCHEMA IF NOT EXISTS sinegasi_ops');
    await db.query('REVOKE ALL ON SCHEMA sinegasi_ops FROM PUBLIC, anon, authenticated, service_role');
    await db.query(`CREATE TABLE IF NOT EXISTS ${history}(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const prior = (await db.query<{checksum:string}>(`SELECT checksum FROM ${history} WHERE name=$1`,[name])).rows[0];
    if (prior) {
      assert.equal(prior.checksum, checksum, 'CHECKSUM_MISMATCH');
      await db.query('COMMIT'); return false;
    }
    await db.query(sql);
    await db.query(`INSERT INTO ${history}(name,checksum) VALUES($1,$2)`,[name,checksum]);
    await db.query('COMMIT'); return true;
  } catch(error) {
    const pgError=error as {code?:string;position?:string};
    diagnostic={code:pgError.code,position:pgError.position};
    await db.query('ROLLBACK'); throw error;
  }
}
function sorted<T>(values: T[]): T[] { return values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))); }
async function verify(db: pg.Client, s: SchemaSnapshot): Promise<void> {
  stage='VERIFY_CATALOG';
  const inventory = await databaseInventory(db);
  assert.deepEqual(inventory.tables.map(t=>({name:t.name, rows:t.rows, rls:t.rls,forceRls:t.forceRls})),
    s.tables.map(t=>({name:t.relname,rows:'0',rls:true,forceRls:false})), 'ROWS_RLS_MISMATCH');
  const columns = inventory.structure.filter(o=>o.kind==='column' && !s.views.some(v => String(o.name).startsWith(v.name+'.'))).map(o=>{
    const d=JSON.parse(String(o.definition)) as {type:string;notNull:boolean;default:string|null;identity:string};
    return {name:o.name,type:d.type,notNull:d.notNull,default:d.default,identity:d.identity};
  });
  assert.deepEqual(sorted(columns), sorted(s.tables.flatMap(t=>t.columns.map(c=>({name:t.relname+'.'+c.name,type:c.type,notNull:c.notNull,default:c.default,identity:c.identity})))), 'COLUMNS_MISMATCH');
  const actualConstraints=sorted(inventory.structure.filter(o=>o.kind==='constraint').map(o=>({name:String(o.name),definition:canonicalConstraintDefinition(String(o.name),String(o.definition))})));
  const expectedConstraints=sorted(s.constraints.map(c=>({name:c.table+'.'+c.name,definition:canonicalConstraintDefinition(c.table+'.'+c.name,c.definition)})));
  if(JSON.stringify(actualConstraints)!==JSON.stringify(expectedConstraints)) {
    const differences=actualConstraints.filter(a=>!expectedConstraints.some(e=>JSON.stringify(e)===JSON.stringify(a)));
    // Schema definitions only, from a disposable DB with no business rows.
    catalogDiagnostic={kind:'CONSTRAINT_DIFFERENCE',actualCount:actualConstraints.length,expectedCount:expectedConstraints.length,
      differences:differences.slice(0,3).map(a=>({name:a.name,actual:a.definition,expected:expectedConstraints.find(e=>e.name===a.name)?.definition}))};
  }
  assert.deepEqual(actualConstraints,expectedConstraints,'CONSTRAINTS_MISMATCH');
  for(const [kind,expected] of [
    ['enum',s.enums.map(e=>({name:e.name,definition:JSON.stringify(e.labels)}))],
    ['trigger',s.triggers.map(t=>({name:t.table+'.'+t.name,definition:t.definition}))],
    ['view',s.views.map(v=>({name:v.name,definition:v.definition}))],
  ] as const) {
    const normalize=(items: {name:unknown;definition:unknown}[])=>sorted(items.map(o=>({name:o.name,definition:kind==='enum' ? JSON.stringify(JSON.parse(String(o.definition))) : String(o.definition).trim()})));
    assert.deepEqual(normalize(inventory.structure.filter(o=>o.kind===kind).map(o=>({name:o.name,definition:o.definition}))),normalize(expected),kind.toUpperCase()+'_MISMATCH');
  }
  const indexRows = (await db.query<{name:string;definition:string}>(`SELECT c.relname AS name,pg_get_indexdef(c.oid) AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i'
    AND NOT EXISTS(SELECT 1 FROM pg_constraint co WHERE co.conindid=c.oid) ORDER BY c.relname`)).rows;
  assert.deepEqual(sorted(indexRows),sorted(s.indexes.map(i=>({name:i.name,definition:i.definition}))), 'INDEXES_MISMATCH');
  const policies=(await db.query(`SELECT tablename AS "table",policyname AS name,permissive,roles::text AS roles,cmd,qual,with_check AS "check"
    FROM pg_policies WHERE schemaname='public'`)).rows;
  assert.deepEqual(sorted(policies),sorted(s.policies),'POLICIES_MISMATCH');
  const viewOptions=(await db.query<{name:string;options:string[]}>(`SELECT c.relname AS name,c.reloptions AS options
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'`)).rows;
  assert.ok(viewOptions.every(v=>v.options?.includes('security_invoker=true')),'UNSAFE_VIEW');
  const bodies = (await db.query<{signature:string;body:string;definer:boolean;config:string[]|null}>(`SELECT p.oid::regprocedure::text AS signature,p.prosrc AS body,p.prosecdef AS definer,p.proconfig AS config
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`)).rows;
  assert.equal(bodies.length,s.functions.length,'FUNCTION_COUNT_MISMATCH');
  for(const f of s.functions) {
    const actual=bodies.find(b=>b.signature===f.signature);
    const match=/AS (\$[A-Za-z_0-9]*\$)([\s\S]*)\1\s*$/.exec(f.definition);
    assert.ok(match,'FUNCTION_BODY_FORMAT');
    assert.equal(actual?.body.replaceAll('\r\n','\n'),match[2].replaceAll('\r\n','\n'),'FUNCTION_BODY_CHANGED:'+f.name);
    assert.equal(actual?.definer,f.securityDefiner,'DEFINER_CHANGED');
    const search=actual?.config?.find(c=>c.startsWith('search_path='));
    assert.ok(search && (search==='search_path=""' || search.includes('pg_temp')),'UNSAFE_SEARCH_PATH');
  }
  for(const role of ['anon','authenticated']) {
    const exposure=(await db.query<{count:string}>(`SELECT count(*)::text AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','v') AND
      (has_table_privilege($1,c.oid,'SELECT') OR has_table_privilege($1,c.oid,'INSERT') OR has_table_privilege($1,c.oid,'UPDATE') OR has_table_privilege($1,c.oid,'DELETE'))`,[role])).rows[0];
    assert.equal(exposure.count,'0','BROWSER_TABLE_EXPOSURE');
    const rpc=(await db.query<{count:string}>(`SELECT count(*)::text AS count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
      AND has_function_privilege($1,p.oid,'EXECUTE')`,[role])).rows[0];
    assert.equal(rpc.count,'0','BROWSER_RPC_EXPOSURE');
    await db.query('BEGIN'); await db.query(`SET LOCAL ROLE ${quoteIdentifier(role)}`);
    try { await assert.rejects(db.query('SELECT * FROM public.users'),e=>(e as {code?:string}).code==='42501'); }
    finally { await db.query('ROLLBACK'); }
  }
  await db.query('BEGIN'); await db.query('SET LOCAL ROLE service_role');
  await db.query('SELECT id FROM public.users LIMIT 1');
  await db.query('SELECT * FROM public.v_student_dashboard_summary LIMIT 1');
  await assert.rejects(db.query('SELECT * FROM public.schema_migrations'),e=>(e as {code?:string}).code==='42501');
  await db.query('ROLLBACK');
}
async function exercise(database: string,s: SchemaSnapshot,sql:[string,string]): Promise<void> {
  stage=database+':CONNECT';
  const db=client(database); await db.connect();
  try {
    assert.equal((await db.query("SELECT current_setting('server_version') AS version")).rows[0].version.startsWith('17.11'),true);
    const locked=(await db.query("SELECT pg_try_advisory_lock(hashtext('sinegasi:schema-migrations')) AS acquired")).rows[0].acquired;
    assert.equal(locked,true);
    const contender=client(database); await contender.connect();
    try { assert.equal((await contender.query("SELECT pg_try_advisory_lock(hashtext('sinegasi:schema-migrations')) AS acquired")).rows[0].acquired,false); }
    finally { await contender.end(); }
    stage=database+':ENUMS';
    await apply(db,RECONCILIATION_FILES[0],sql[0]);
    const before=await databaseInventory(db);
    stage=database+':ROLLBACK';
    await assert.rejects(apply(db,RECONCILIATION_FILES[1],sql[1]+"\nDO $fail$ BEGIN RAISE EXCEPTION 'INJECTED_FAILURE'; END $fail$;"),e=>(e as {message?:string}).message==='INJECTED_FAILURE');
    assert.deepEqual(await databaseInventory(db),before,'DDL_ROLLBACK_FAILED');
    assert.equal((await db.query(`SELECT count(*)::int AS count FROM ${history} WHERE name=$1`,[RECONCILIATION_FILES[1]])).rows[0].count,0,'HISTORY_ROLLBACK_FAILED');
    stage=database+':SCHEMA';
    assert.equal(await apply(db,RECONCILIATION_FILES[1],sql[1]),true);
    await verify(db,s);
    assert.equal(await apply(db,RECONCILIATION_FILES[0],sql[0]),false);
    assert.equal(await apply(db,RECONCILIATION_FILES[1],sql[1]),false);
    await assert.rejects(apply(db,RECONCILIATION_FILES[1],sql[1]+'\n-- tampered\n'),/CHECKSUM_MISMATCH/);
    await db.query('BEGIN');
    await db.query('INSERT INTO public.api_idempotency_responses(cache_key,status_code,payload,expires_at) VALUES($1,200,$2,now())',['isolated-fixture','{}']);
    await assert.rejects(db.query(sql[1]),e=>(e as {message?:string}).message==='NONEMPTY_DATABASE_REFUSED');
    await db.query('ROLLBACK');
    await verify(db,s);
  } finally { await db.end(); }
}
async function main(): Promise<void> {
  const freshOnly=process.argv[2]==='isolated-schema-fresh';
  if((!freshOnly && process.argv[2]!=='isolated-schema-reconciliation') || process.argv.length!==3) throw new Error('ISOLATED_MODE_REQUIRED');
  const value:unknown=JSON.parse(await readFile(resolve(directory,'production-schema.snapshot.json'),'utf8'));
  validateSnapshot(value); const s=value;
  const sql=compileReconciliation(s);
  for(let i=0;i<2;i++) assert.equal(await readFile(resolve(directory,RECONCILIATION_FILES[i]),'utf8'),sql[i],'PACKAGE_BYTES_CHANGED');
  const db=client('sinegasi_backup_restore'); await db.connect();
  try {
    const before=await databaseInventory(db);
    assert.equal(before.tables.length,freshOnly ? 0 : s.legacyTables.length,'LEGACY_BACKUP_REQUIRED');
    assert.ok(before.tables.every(t=>t.rows==='0'),'NONEMPTY_BACKUP_REFUSED');
    await db.query('CREATE DATABASE sinegasi_schema_fresh TEMPLATE template0');
  } finally { await db.end(); }
  const fresh=client('sinegasi_schema_fresh'); await fresh.connect();
  try {
    await fresh.query('CREATE EXTENSION pg_trgm WITH SCHEMA public; CREATE EXTENSION pgcrypto WITH SCHEMA public; CREATE EXTENSION "uuid-ossp" WITH SCHEMA public;');
  } finally { await fresh.end(); }
  await exercise('sinegasi_schema_fresh',s,sql);
  if(!freshOnly) await exercise('sinegasi_backup_restore',s,sql);
  console.log(JSON.stringify({status:freshOnly ? 'RECONCILIATION_FRESH_REHEARSAL_PASSED' : 'RECONCILIATION_SCHEMA_REHEARSAL_PASSED',packageSha256:sha256(sql.join('\n')),
    tables:s.tables.length,functions:s.functions.length,constraints:s.constraints.length,indexes:s.indexes.length,triggers:s.triggers.length,
    checks:{freshDatabase:true,restoredLegacyBackup:!freshOnly,emptyBusinessTables:true,rlsAllTables:true,columnsConstraintsIndexesEnumsViewsTriggersPoliciesMatch:true,
      functionBodiesAndDefinerSemanticsPreserved:true,browserTableAndRpcDenied:true,serviceRoleAccess:true,ddlAndHistoryRollback:true,
      repeatIsNoop:true,checksumDriftRefused:true,nonemptyDatabaseRefused:true,concurrentRunnerRefused:true},
    productionChanged:false,devDatabaseChanged:false,productionApproved:false,applicationFlowTestsPassed:false,managedSupabaseIntegrationTested:false}));
}
void main().catch((error:unknown)=>{
  const safe = error instanceof assert.AssertionError ? String(error.message).split(':')[0].split('\n')[0] : (error as {code?:string}).code ?? 'RECONCILIATION_TEST_FAILED';
  // Structured failure is consumed by the parent; only PASSED is accepted.
  console.log(JSON.stringify({status:'RECONCILIATION_REHEARSAL_FAILED',stage,check:safe,diagnostic,catalogDiagnostic,productionChanged:false}));
});
