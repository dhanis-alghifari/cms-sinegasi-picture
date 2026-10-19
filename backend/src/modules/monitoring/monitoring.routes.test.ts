import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import test, { type TestContext } from 'node:test';
import Fastify, { LogController } from 'fastify';
import jwt from '@fastify/jwt';
import monitoringRoutes from './monitoring.routes.js';
import { registerMonitoringHooks } from '../../shared/monitoring/requestMonitoring.js';

const report = { kind: 'runtime', code: 'RUNTIME_ERROR' };
const fixtureSecret = 'isolated-monitoring-fixture-secret-no-live-access';

async function fixture(t: TestContext) {
  const logs: Array<Record<string, unknown>> = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of String(chunk).trim().split('\n')) logs.push(JSON.parse(line));
      callback();
    },
  });
  const app = Fastify({ logger: { stream }, logController: new LogController({ disableRequestLogging: true }), genReqId: () => randomUUID() });
  await app.register(jwt, { secret: fixtureSecret });
  registerMonitoringHooks(app);
  await app.register(monitoringRoutes);
  t.after(() => app.close());
  function headers(userId = '11111111-1111-4111-8111-111111111111', isFirstLogin = false) {
    return { authorization: `Bearer ${app.jwt.sign({ userId, username: 'private-fixture-username', role: 'teacher', isFirstLogin })}` };
  }
  return { app, logs, headers };
}

test('diagnostics require the existing verified session and preserve first-login restrictions', async (t) => {
  const { app, logs, headers } = await fixture(t);
  const request = { method: 'POST' as const, url: '/api/monitoring/client-errors', payload: report };
  assert.equal((await app.inject(request)).statusCode, 401);
  assert.equal((await app.inject({ ...request, headers: headers(undefined, true) })).statusCode, 403);
  assert.equal(logs.some((entry) => entry.event === 'monitoring.client_error'), false);
});

test('accepted reports are strictly structured and labelled as client-reported evidence', async (t) => {
  const { app, logs, headers } = await fixture(t);
  const response = await app.inject({
    method: 'POST', url: '/api/monitoring/client-errors', headers: headers(),
    payload: { ...report, requestId: '33333333-3333-4333-8333-333333333333', release: 'build-a1b2c3', statusCode: 503 },
  });
  assert.equal(response.statusCode, 204);
  assert.equal(response.body, '');
  const event = logs.find((entry) => entry.event === 'monitoring.client_error');
  assert.equal(event?.actorId, '11111111-1111-4111-8111-111111111111');
  assert.equal(event?.source, 'client_report');
  assert.equal(event?.clientRequestId, '33333333-3333-4333-8333-333333333333');
  assert.equal(event?.clientStatusCode, 503);
  assert.equal(event?.statusCode, 204);
  assert.equal('release' in (event ?? {}), false);
  assert.equal(JSON.stringify(logs).includes('private-fixture-username'), false);
  assert.equal(logs.some((entry) => entry.event === 'monitoring.activity'), false);
});

test('arbitrary correlation labels and release identifiers are not retained in logs', async (t) => {
  const { app, logs, headers } = await fixture(t);
  const response = await app.inject({
    method: 'POST', url: '/api/monitoring/client-errors', headers: headers(),
    payload: { ...report, requestId: 'private-correlation-fixture', release: 'private-release-fixture' },
  });
  assert.equal(response.statusCode, 204);
  const event = logs.find((entry) => entry.event === 'monitoring.client_error');
  assert.equal(event?.clientRequestId, undefined);
  assert.equal(JSON.stringify(logs).includes('private-correlation-fixture'), false);
  assert.equal(JSON.stringify(logs).includes('private-release-fixture'), false);
});

test('rejects arbitrary diagnostic fields and unsafe values without recording their content', async (t) => {
  const { app, logs, headers } = await fixture(t);
  for (const payload of [
    { ...report, message: 'private-fixture-message' },
    { ...report, stack: 'private-fixture-stack' },
    { ...report, kind: 'private-fixture-kind' },
    { ...report, code: 'private-fixture-code' },
    { ...report, release: 'https://private-fixture.invalid/?token=x' },
    { ...report, requestId: 'private-fixture\nlog-injection' },
    { ...report, statusCode: 200 },
    { ...report, statusCode: 503.5 },
    { ...report, actorId: '22222222-2222-4222-8222-222222222222' },
  ]) {
    const response = await app.inject({ method: 'POST', url: '/api/monitoring/client-errors', headers: headers(), payload });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(logs.some((entry) => entry.event === 'monitoring.client_error'), false);
  assert.equal(JSON.stringify(logs).includes('private-fixture'), false);
});

test('tiny body and per-account budgets cap browser-error noise without changing normal auth limits', async (t) => {
  const { app, logs, headers } = await fixture(t);
  const request = { method: 'POST' as const, url: '/api/monitoring/client-errors', headers: headers(), payload: report };
  const oversized = await app.inject({ ...request, payload: { ...report, release: 'x'.repeat(1_100) } });
  assert.equal(oversized.statusCode, 413);
  for (let count = 0; count < 5; count += 1) assert.equal((await app.inject(request)).statusCode, 204);
  const limited = await app.inject(request);
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error_code, 'DIAGNOSTIC_LIMIT_REACHED');
  assert.equal(typeof limited.headers['retry-after'], 'string');
  assert.equal((await app.inject({ ...request, headers: headers('22222222-2222-4222-8222-222222222222') })).statusCode, 204);
  assert.equal(logs.filter((entry) => entry.event === 'monitoring.client_error').length, 6);
  assert.equal(logs.some((entry) => entry.event === 'monitoring.api_error'), false);
});

test('a per-process budget bounds total telemetry and account-map size', async (t) => {
  const { app, headers } = await fixture(t);
  for (let index = 0; index < 60; index += 1) {
    const actorId = `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
    const response = await app.inject({ method: 'POST', url: '/api/monitoring/client-errors', headers: headers(actorId), payload: report });
    assert.equal(response.statusCode, 204);
  }
  const response = await app.inject({ method: 'POST', url: '/api/monitoring/client-errors', headers: headers(), payload: report });
  assert.equal(response.statusCode, 429);
});
