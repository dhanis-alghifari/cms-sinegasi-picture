import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('075 derives debt settlement amount from the locked debt row', async () => {
  const sql = await readFile(path.resolve(__dirname, '075_cash_dispute_derive_debt_amount.sql'), 'utf8');

  assert.match(sql, /p_resolution_amount IS NOT NULL/);
  assert.match(sql, /v_debt\.amount,\s*\n\s*'Pembayaran terverifikasi/);
  assert.match(sql, /v_balance \+ v_debt\.amount/);
  assert.match(sql, /FROM public\.debt_records\s*\n\s*WHERE id = v_dispute\.debt_record_id\s*\n\s*FOR UPDATE/);
});
