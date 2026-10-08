import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('089 bounds list photo payloads and database-side borrowing search access', async () => {
  const sql = await readFile(path.resolve(__dirname, '089_query_performance_hardening.sql'), 'utf8');

  for (const indexName of [
    'idx_borrowings_created_at_id',
    'idx_borrowings_student_created_at_id', 'idx_borrowings_status_created_at_id',
    'idx_borrowings_borrowed_due_at', 'idx_borrowings_borrowed_planned_return',
  ]) {
    assert.match(sql, new RegExp(`CREATE INDEX IF NOT EXISTS ${indexName}`));
  }

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_equipment_primary_photo\(p_equipment_id UUID\)[\s\S]+SECURITY INVOKER/);
  assert.match(sql, /COALESCE\(NULLIF\(BTRIM\(e\.foto_url\), ''\), NULLIF\(BTRIM\(e\.fotos\[1\]\), ''\)\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_equipment_primary_photo\(UUID\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_equipment_primary_photo\(UUID\) TO service_role/);

  const searchFunction = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.search_borrowings_page_ids'));
  assert.match(searchFunction, /RETURNS JSONB[\s\S]+SECURITY INVOKER/);
  assert.match(searchFunction, /length\(btrim\(p_search\)\) NOT BETWEEN 1 AND 100/);
  assert.match(searchFunction, /LIMIT p_limit OFFSET p_offset/);
  assert.match(searchFunction, /SELECT count\(\*\) FROM matched/);
  assert.match(searchFunction, /REVOKE ALL ON FUNCTION public\.search_borrowings_page_ids[\s\S]+FROM PUBLIC, anon, authenticated/);
  assert.match(searchFunction, /GRANT EXECUTE ON FUNCTION public\.search_borrowings_page_ids[\s\S]+TO service_role/);
  assert.match(searchFunction, /NOTIFY pgrst, 'reload schema'/);
});
