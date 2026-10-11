import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('optional agenda instructor migration updates existing atomic RPCs without changing their signatures', async () => {
  const sql = await readFile(path.resolve(__dirname, '084_agenda_optional_instructor.sql'), 'utf8');
  assert.match(sql, /ALTER TABLE public\.agenda_activities ALTER COLUMN instructor_name DROP NOT NULL/);
  assert.match(sql, /create_agenda_activity_atomic\(date,text,text,text,text\[\],uuid,text,uuid,uuid,text\)/);
  assert.match(sql, /update_agenda_activity_atomic\(uuid,date,text,text,text,text\[\],integer,text,uuid,text,uuid,uuid,text\)/);
  assert.equal((sql.match(/CREATE TABLE/gi) || []).length, 0);
  assert.ok(sql.includes("NULLIF(btrim(p_instructor_name), '''')"));
  assert.match(sql, /ELSIF strpos\(v_rewritten, v_new\) = 0 THEN/);
  assert.match(sql, /AGENDA_CREATE_INSTRUCTOR_VALIDATION_NOT_FOUND/);
  assert.match(sql, /AGENDA_UPDATE_INSTRUCTOR_VALIDATION_NOT_FOUND/);
});
