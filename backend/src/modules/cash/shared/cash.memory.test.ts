import assert from 'node:assert/strict';
import test from 'node:test';
import { createCashMemoryState } from './cash.memory.js';

test('cash memory factory creates one shared empty ledger with safe defaults', () => {
  const state = createCashMemoryState();
  assert.deepEqual(state.transactions, []);
  assert.deepEqual(state.debts, []);
  assert.equal(state.billingRules.nominal_iuran_wajib, 5000);
  assert.deepEqual(state.paymentMethods.map((method) => method.code), ['cash', 'qris_dana', 'qris_gopay']);
  assert.ok(state.paymentMethods.every((method) => method.is_active));
});
