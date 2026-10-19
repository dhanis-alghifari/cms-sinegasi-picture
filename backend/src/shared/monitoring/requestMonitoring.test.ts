import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import test, { type TestContext } from 'node:test';
import Fastify, { LogController } from 'fastify';
import { auditMiddleware, getAuditRequestContext } from '../../middleware/auditMiddleware.js';
import { markVerifiedMonitoringActor, registerMonitoringHooks } from './requestMonitoring.js';

const actor = { userId: '11111111-1111-4111-8111-111111111111', role: 'teacher' as const };

function fixture(t: TestContext, now?: () => number) {
  const logs: Array<Record<string, unknown>> = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of String(chunk).trim().split('\n')) logs.push(JSON.parse(line));
      callback();
    },
  });
  const app = Fastify({ logger: { stream }, logController: new LogController({ disableRequestLogging: true }), requestIdHeader: false, genReqId: () => randomUUID() });
  registerMonitoringHooks(app, now);
  t.after(() => app.close());
  return { app, logs };
}

test('monitoring records template routes and fixed API categories without raw request data', async (t) => {
  const { app, logs } = fixture(t);
  app.get('/api/items/:id', async (_request, reply) => reply.status(503).send({ error: 'fixture' }));
  const response = await app.inject({
    url: '/api/items/private-fixture-id?token=private-query-value',
    headers: { authorization: 'Bearer private-fixture-token', 'x-request-id': 'caller-controlled-id' },
  });
  assert.equal(response.statusCode, 503);
  const event = logs.find((entry) => entry.event === 'monitoring.api_error');
  assert.equal(event?.route, '/api/items/:id');
  assert.equal(event?.code, 'HTTP_5XX');
  assert.match(String(event?.eventId), /^[a-f0-9-]{36}$/);
  assert.match(String(event?.requestId), /^[a-f0-9-]{36}$/);
  for (const forbidden of ['private-fixture-id', 'private-query-value', 'private-fixture-token', 'caller-controlled-id']) {
    assert.equal(JSON.stringify(logs).includes(forbidden), false);
  }
});

test('decoded or caller-supplied user objects are not treated as verified activity', async (t) => {
  const { app, logs } = fixture(t);
  app.get('/api/private', async (request, reply) => {
    request.user = { ...actor, username: 'unverified-user', isFirstLogin: false };
    return reply.status(403).send();
  });
  await app.inject('/api/private');
  assert.equal(logs.some((entry) => entry.event === 'monitoring.activity'), false);
  assert.equal(logs.some((entry) => entry.actorId !== undefined), false);
});

test('activity is sampled once per verified account per minute and excludes usernames', async (t) => {
  let now = 1_000;
  const { app, logs } = fixture(t, () => now);
  app.get('/api/private', {
    preHandler: async (request) => markVerifiedMonitoringActor(request, actor),
  }, async () => ({ success: true }));
  await app.inject('/api/private');
  await app.inject('/api/private');
  assert.equal(logs.filter((entry) => entry.event === 'monitoring.activity').length, 1);
  now += 60_000;
  await app.inject('/api/private');
  const events = logs.filter((entry) => entry.event === 'monitoring.activity');
  assert.equal(events.length, 2);
  assert.equal(events[0].actorId, actor.userId);
  assert.equal(events[0].role, actor.role);
  assert.equal('username' in events[0], false);
});

test('login outcome events cover success, credential rejection, validation, limits, and outage', async (t) => {
  const { app, logs } = fixture(t);
  let status = 200;
  app.post('/api/auth/login', async (request, reply) => {
    if (status === 200) markVerifiedMonitoringActor(request, actor);
    return reply.status(status).send();
  });
  for (status of [200, 401, 400, 429, 503]) await app.inject({ method: 'POST', url: '/api/auth/login' });
  const events = logs.filter((entry) => entry.event === 'monitoring.login');
  assert.deepEqual(events.map((entry) => entry.outcome), ['success', 'invalid_credentials', 'rejected', 'rate_limited', 'unavailable']);
  assert.equal(events[0].actorId, actor.userId);
  assert.equal(events.slice(1).every((entry) => entry.actorId === undefined), true);
});

test('collector failures never recursively become API error monitoring events', async (t) => {
  const { app, logs } = fixture(t);
  app.post('/api/monitoring/client-errors', async (_request, reply) => reply.status(429).send());
  await app.inject({ method: 'POST', url: '/api/monitoring/client-errors' });
  assert.equal(logs.some((entry) => entry.event === 'monitoring.api_error'), false);
});

test('audit metadata shares the server request UUID while retaining a separate operation UUID', async (t) => {
  const { app } = fixture(t);
  app.addHook('onRequest', auditMiddleware);
  app.post('/api/fixture', async (request) => ({ requestId: request.id, context: getAuditRequestContext(request) }));
  const response = await app.inject({ method: 'POST', url: '/api/fixture' });
  const data = response.json();
  assert.equal(data.context.requestId, data.requestId);
  assert.match(data.context.operationId, /^[a-f0-9-]{36}$/);
  assert.notEqual(data.context.operationId, data.requestId);
});
