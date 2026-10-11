import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('agenda migration keeps factual dates, private photos, and auditable mutations', async () => {
  const sql = await readFile(path.resolve(__dirname, '070_agenda_activities.sql'), 'utf8');
  for (const token of [
    'CREATE TABLE IF NOT EXISTS public.agenda_activities',
    'CREATE TABLE IF NOT EXISTS public.agenda_activity_operations',
    'CREATE TABLE IF NOT EXISTS public.agenda_activity_photos',
    'ADD COLUMN IF NOT EXISTS pic_names_search TEXT',
    "activity_date > (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE",
    'BEFORE INSERT OR UPDATE OF activity_date, pic_names',
    'create_agenda_activity_atomic',
    'update_agenda_activity_atomic',
    'archive_agenda_activity_atomic',
    'reserve_agenda_photo_atomic',
    'attach_agenda_photo_atomic',
    'write_audit_log',
    'AGENDA_VERSION_CONFLICT',
    'ALTER TABLE public.agenda_activities ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE public.agenda_migration_history ENABLE ROW LEVEL SECURITY',
    'REVOKE ALL ON FUNCTION public.create_agenda_activity_atomic',
    'GRANT EXECUTE ON FUNCTION public.attach_agenda_photo_atomic',
  ]) {
    assert.ok(sql.includes(token), `migration is missing: ${token}`);
  }
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.agenda_activities TO service_role/);
  assert.doesNotMatch(sql, /pic_names_search[\s\S]*GENERATED ALWAYS/i);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.[^(]+\([^)]*\) TO (PUBLIC|anon|authenticated)/i);
});
