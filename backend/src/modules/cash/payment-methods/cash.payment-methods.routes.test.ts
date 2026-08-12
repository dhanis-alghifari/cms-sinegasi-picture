import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import cashPaymentMethodsRoutes from './cash.payment-methods.routes.js';
import { CashPaymentMethodsService } from './cash.payment-methods.service.js';

test('cash payment method routes expose manager CRUD with audit callback', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  let auditAction = '';
  const service = {
    repositoryIsConfigured: () => false,
    list: async () => [{ id: 'cash-1', code: 'cash', label: 'Cash', is_active: true, sort_order: 10 }],
    create: async () => ({ id: 'qris-1', code: 'qris_dana', label: 'QRIS DANA', is_active: true, sort_order: 20 }),
    update: async () => ({
      previous: { id: 'cash-1', code: 'cash', label: 'Cash', is_active: true, sort_order: 10 },
      current: { id: 'cash-1', code: 'cash', label: 'Cash Updated', is_active: true, sort_order: 10 },
    }),
  } as unknown as CashPaymentMethodsService;
  await app.register(cashPaymentMethodsRoutes, {
    paymentMethodsService: service,
    persistAuditLog: async (_request, input) => { auditAction = input.action; },
  });
  t.after(() => app.close());

  const token = app.jwt.sign({ userId: 'user-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}` };
  const list = await app.inject({ method: 'GET', url: '/api/cash/payment-methods', headers });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data[0].code, 'cash');

  const create = await app.inject({
    method: 'POST', url: '/api/cash/payment-methods', headers,
    payload: { code: 'qris_dana', label: 'QRIS DANA', change_reason: 'Tambah QRIS' },
  });
  assert.equal(create.statusCode, 201);
  assert.equal(auditAction, 'INSERT');
});

test('cash payment method route denies member access to inactive methods', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(cashPaymentMethodsRoutes, {
    paymentMethodsService: {} as CashPaymentMethodsService,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());

  const token = app.jwt.sign({ userId: 'user-1', username: 'member', role: 'member', isFirstLogin: false });
  const response = await app.inject({
    method: 'GET', url: '/api/cash/payment-methods?include_inactive=true',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.statusCode, 403);
});
