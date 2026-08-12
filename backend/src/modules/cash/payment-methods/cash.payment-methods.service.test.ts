import assert from 'node:assert/strict';
import test from 'node:test';
import { CashPaymentMethodsService, CashPaymentMethodsServiceError } from './cash.payment-methods.service.js';
import { createCashPaymentMethodsRepository } from './cash.payment-methods.repository.js';
import type { CashPaymentMethod } from '../shared/cash.types.js';

function method(id: string, code: string, isActive = true): CashPaymentMethod {
  const now = new Date().toISOString();
  return { id, code, label: code, is_active: isActive, sort_order: 10, created_at: now, updated_at: now };
}

test('cash payment method service validates, creates, and updates memory methods', async () => {
  const methods = [method('cash-1', 'cash'), method('qris-1', 'qris_dana')];
  const service = new CashPaymentMethodsService(createCashPaymentMethodsRepository(null, methods));

  const created = await service.create({ code: 'bank_transfer', label: 'Bank Transfer', sort_order: 30 }, 'user-1', 'Tambah metode bank');
  assert.equal(created.code, 'bank_transfer');
  assert.equal(methods.length, 3);

  const updated = await service.update(created.id, { label: 'Transfer Bank', is_active: false }, 'user-1', 'Nonaktifkan metode');
  assert.equal(updated.current.label, 'Transfer Bank');
  assert.equal(updated.current.is_active, false);
});

test('cash payment method service protects the default method and last active method', async () => {
  const methods = [method('cash-1', 'cash'), method('qris-1', 'qris_dana', false)];
  const service = new CashPaymentMethodsService(createCashPaymentMethodsRepository(null, methods));

  await assert.rejects(
    service.update('cash-1', { is_active: false }, 'user-1', 'Nonaktifkan cash'),
    (error: unknown) => error instanceof CashPaymentMethodsServiceError && error.errorCode === 'DEFAULT_METHOD_REQUIRED',
  );
  await assert.rejects(
    service.create({ code: 'cash', label: 'Cash' }, 'user-1', 'Tambah duplikat'),
    (error: unknown) => error instanceof CashPaymentMethodsServiceError && error.statusCode === 409,
  );
});

test('cash payment method service requires an auditable change reason', async () => {
  const service = new CashPaymentMethodsService(createCashPaymentMethodsRepository(null, [method('cash-1', 'cash')]));
  await assert.rejects(
    service.create({ code: 'qris', label: 'QRIS' }, 'user-1', 'no'),
    (error: unknown) => error instanceof CashPaymentMethodsServiceError && error.errorCode === 'CHANGE_REASON_REQUIRED',
  );
});
