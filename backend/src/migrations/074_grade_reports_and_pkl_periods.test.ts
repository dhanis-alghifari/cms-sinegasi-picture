import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('074 adds auditable semester reports and keeps PKL separate from attendance status', async () => {
  const sql = await readFile(path.resolve(__dirname, '074_grade_reports_and_pkl_periods.sql'), 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.grade_report_periods/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.student_pkl_periods/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.grade_reports/);
  assert.match(sql, /status TEXT NOT NULL DEFAULT 'pending'/);
  assert.match(sql, /status TEXT NOT NULL DEFAULT 'draft'/);
  assert.match(sql, /predikat public\.grade_value/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.grade_report_periods, public\.student_pkl_periods, public\.grade_reports FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.grade_report_periods, public\.student_pkl_periods, public\.grade_reports TO service_role/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});
