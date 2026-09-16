import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const sql = readFileSync(path.resolve(__dirname, '064_equipment_charge_payment_evidence.sql'), 'utf8');

describe('equipment charge payment evidence migration', () => {
  it('defines private evidence metadata and an atomic incremental payment event', () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.equipment_charge_payments/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.equipment_evidence/i);
    assert.match(sql, /reserve_equipment_charge_evidence_atomic/i);
    assert.match(sql, /record_equipment_charge_payment_event_atomic/i);
    assert.match(sql, /CHARGE_RESOLUTION_EVIDENCE_REQUIRED/i);
    assert.match(sql, /v_required_resolution_evidence := CASE/i);
    assert.match(sql, /v_charge_status = 'waived'/i);
    assert.match(sql, /upload_status = 'attached'/i);
    assert.match(sql, /REVOKE ALL ON TABLE public\.equipment_charge_payments, public\.equipment_evidence/i);
  });
});
