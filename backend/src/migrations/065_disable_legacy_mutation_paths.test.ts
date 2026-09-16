import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const sql = readFileSync(path.resolve(__dirname, '065_disable_legacy_mutation_paths.sql'), 'utf8');

test('legacy mutation RPCs are replaced and revoked after canonical flows are deployed', () => {
  assert.match(sql, /MIGRATION_PREFLIGHT_FAILED/i);
  assert.match(sql, /record_equipment_charge_payment_event_atomic\(uuid,numeric,uuid\[\]/i);
  assert.match(sql, /finalize_contest_entry_atomic\(uuid,text,jsonb,uuid/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.record_equipment_charge_payment_atomic/i);
  assert.match(sql, /MESSAGE = 'CHARGE_PAYMENT_LEGACY_DISABLED'/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.record_contest_entry_result_atomic/i);
  assert.match(sql, /MESSAGE = 'CONTEST_RESULT_LEGACY_DISABLED'/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.record_equipment_charge_payment_atomic[\s\S]+service_role/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.record_contest_entry_result_atomic[\s\S]+service_role/i);
  assert.match(sql, /record_equipment_charge_payment_event_atomic/i);
  assert.match(sql, /finalize_contest_entry_atomic/i);
  assert.doesNotMatch(sql, /DROP TABLE\s+public\./i);
});
