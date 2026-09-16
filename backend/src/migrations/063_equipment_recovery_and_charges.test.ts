import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const sql = readFileSync(path.resolve(__dirname, '063_equipment_recovery_and_charges.sql'), 'utf8');

describe('equipment recovery and charge migration', () => {
  it('defines the recovery lifecycle, charge ledger, and guarded transitions', () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.equipment_recovery_cases/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.equipment_charge_settlements/i);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_equipment_recovery_case_atomic/i);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.complete_equipment_repair_atomic/i);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.register_equipment_replacement_atomic/i);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.record_equipment_charge_payment_atomic/i);
    assert.match(sql, /trg_block_borrowing_approval_with_unpaid_charge/i);
    assert.match(sql, /trg_enforce_equipment_state_consistency/i);
    assert.match(sql, /RECOVERY_INSPECTION_REQUIRED/i);
    assert.match(sql, /Reconcile legacy rows/i);
    assert.doesNotMatch(sql, /SELECT ev\.id, ev\.replacement_value INTO v_valuation_id, v_value/i);
  });
});
