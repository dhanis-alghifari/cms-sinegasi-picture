import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import cashReadRoutes from './cash.read.routes.js';
import { CashReadService, CashReadServiceError } from './cash.read.service.js';

function token(app: ReturnType<typeof Fastify>): string {
  return app.jwt.sign({
    userId: 'usr-1',
    username: 'treasurer',
    role: 'treasurer',
    isFirstLogin: false,
  });
}

test('cash read routes keep authenticated response envelopes for the treasurer role', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  let receivedScope: { studentId: string | null } | undefined;
  const service = {
    getSummary: async (scope: { studentId: string | null }) => {
      receivedScope = scope;
      return { saldoUtama: 100000, totalPemasukan: 100000, totalPengeluaran: 0, totalTunggakanSiswa: 0 };
    },
    listTransactions: async () => ({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
  } as unknown as CashReadService;
  await app.register(cashReadRoutes, { cashReadService: service });
  t.after(() => app.close());

  const headers = { authorization: `Bearer ${token(app)}` };
  const response = await app.inject({ method: 'GET', url: '/api/cash/summary', headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().success, true);
  assert.equal(response.json().saldoUtama, 100000);
  assert.deepEqual(receivedScope, { studentId: null });
});

test('cash read routes return service validation errors as HTTP responses', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const service = {
    getSummary: async () => ({ saldoUtama: 0 }),
    listTransactions: async () => {
      throw new CashReadServiceError(422, 'INVALID_START_DATE', 'Tanggal mulai transaksi tidak valid.');
    },
  } as unknown as CashReadService;
  await app.register(cashReadRoutes, { cashReadService: service });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/cash/transactions?tanggal_mulai=2026-99-99',
    headers: { authorization: `Bearer ${token(app)}` },
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().message, 'Tanggal mulai transaksi tidak valid.');
});
