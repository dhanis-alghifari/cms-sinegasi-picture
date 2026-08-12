import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import cashMutationsRoutes from './cash.mutations.routes.js';
import { CashMutationsService } from './cash.mutations.service.js';

test('cash mutation routes keep manager authorization and write response envelopes', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const service = {
    repositoryIsConfigured: () => false,
    recordIn: async () => ({ cashTransaction: { id: 'cash-1' }, result: { payment_status: 'paid' } }),
    recordOut: async () => ({ cashTransaction: { id: 'cash-2' } }),
  } as unknown as CashMutationsService;
  await app.register(cashMutationsRoutes, { cashMutationsService: service });
  t.after(() => app.close());

  const token = app.jwt.sign({ userId: 'user-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}`, 'x-idempotency-key': 'cash-in-123' };
  const income = await app.inject({
    method: 'POST', url: '/api/cash/transactions/in', headers,
    payload: { nominal: 5000, student_id: 'student-1', type: 'iuran_wajib', tanggal: '2026-08-11', metode_pembayaran: 'cash' },
  });
  assert.equal(income.statusCode, 201);
  assert.equal(income.json().result.payment_status, 'paid');

  const expense = await app.inject({
    method: 'POST', url: '/api/cash/transactions/out', headers: { authorization: `Bearer ${token}` },
    payload: { nominal: 1000, keterangan: 'Beli perlengkapan' },
  });
  assert.equal(expense.statusCode, 201);
  assert.equal(expense.json().data.id, 'cash-2');
});

test('cash mutation routes deny member accounts', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(cashMutationsRoutes, { cashMutationsService: {} as CashMutationsService });
  t.after(() => app.close());

  const token = app.jwt.sign({ userId: 'user-1', username: 'member', role: 'member', isFirstLogin: false });
  const response = await app.inject({
    method: 'POST', url: '/api/cash/transactions/out',
    headers: { authorization: `Bearer ${token}` }, payload: { nominal: 1000, keterangan: 'Beli perlengkapan' },
  });
  assert.equal(response.statusCode, 403);
});
