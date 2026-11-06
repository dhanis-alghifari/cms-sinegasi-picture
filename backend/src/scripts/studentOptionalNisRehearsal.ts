import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Emits synthetic SQL only; never connects to a database. */
export async function buildStudentOptionalNisRehearsal(): Promise<string> {
  const root = resolve(__dirname, '../../..');
  const sql = await readFile(resolve(root, 'backend/src/migrations/091_student_optional_nis.sql'), 'utf8');
  const fixture = await readFile(resolve(root, 'backend/src/migrations/fixtures/student_optional_nis_rehearsal.sql'), 'utf8');
  const optionalValidation = "IF (v_nis IS NOT NULL AND (length(v_nis) > 40 OR v_nis !~ '[A-Za-z0-9]'))";
  const functions = [
    ['create_student_with_account_v2', 'IF v_nis IS NULL OR length(v_nis) > 40'],
    ['link_existing_student_account_atomic', 'IF v_nis IS NULL OR LENGTH(v_nis) > 40'],
  ].map(([name, original]) => {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    const end = sql.indexOf('\n$$;', start);
    if (start < 0 || end < 0) throw new Error('REHEARSAL_BASELINE_FUNCTION_MISSING');
    const definition = sql.slice(start, end + '\n$$;'.length);
    if (!definition.includes(optionalValidation)) throw new Error('REHEARSAL_VALIDATION_CHANGED');
    return definition.replace(optionalValidation, original);
  }).join('\n');
  return fixture.replace('-- @BASELINE_FUNCTIONS@', () => functions)
    .replace('-- @OPTIONAL_NIS_MIGRATION_TWICE@', () => `${sql}\n${sql}`);
}

if (require.main === module) {
  if (process.argv.length !== 3 || process.argv[2] !== '--emit-sql') {
    throw new Error('USE_EMIT_SQL_ONLY_ON_DISPOSABLE_REHEARSAL_DATABASE');
  }
  buildStudentOptionalNisRehearsal().then((sql) => process.stdout.write(sql)).catch(() => {
    console.error('STUDENT_NIS_REHEARSAL_GENERATION_FAILED');
    process.exitCode = 1;
  });
}
