import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Emits only synthetic SQL, guarded against application databases. No connection or secrets. */
export async function buildStudentProfileAuditRehearsal(): Promise<string> {
  const root = resolve(__dirname, '../../..');
  const baseline = await readFile(resolve(root, 'supabase/migrations/20261010235346_production_reconciliation_schema.sql'), 'utf8');
  const functions = ['redact_audit_json', 'log_activity', 'update_student_profile_atomic'].map((name) => {
    const start = baseline.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    const end = baseline.indexOf('\n$function$;', start);
    if (start < 0 || end < 0) throw new Error('REHEARSAL_BASELINE_FUNCTION_MISSING');
    return baseline.slice(start, end + '\n$function$;'.length);
  }).join('\n');
  const migration = await readFile(resolve(root, 'backend/src/migrations/090_student_profile_audit_context.sql'), 'utf8');
  const fixture = await readFile(resolve(root, 'backend/src/migrations/fixtures/student_profile_audit_rehearsal.sql'), 'utf8');
  // Apply twice to verify idempotence without rewriting existing functions or grants.
  return fixture.replace('-- @BASELINE_FUNCTIONS@', () => functions)
    .replace('-- @AUDIT_CONTEXT_MIGRATION@', () => `${migration}\n${migration}`);
}

if (require.main === module) {
  if (process.argv.length !== 3 || process.argv[2] !== '--emit-sql') {
    throw new Error('USE_EMIT_SQL_ONLY_ON_DISPOSABLE_REHEARSAL_DATABASE');
  }
  buildStudentProfileAuditRehearsal().then((sql) => process.stdout.write(sql)).catch(() => {
    console.error('STUDENT_PROFILE_REHEARSAL_GENERATION_FAILED');
    process.exitCode = 1;
  });
}
