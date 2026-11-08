// Executed inside the candidate image with an in-memory repository and synthetic identities.
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const jwt = require('@fastify/jwt');
const routes = require('./dist/modules/contests/contests.routes.js').default;
const { ContestsService } = require('./dist/modules/contests/contests.service.js');
const { createContestsRepository } = require('./dist/modules/contests/contests.repository.js');

async function main() {
  const app = Fastify();
  try {
    await app.register(jwt, { secret: 'synthetic-isolated-test-secret-32-characters' });
    await app.register(routes, {
      contestsService: new ContestsService(createContestsRepository(null, { contests: [], submissions: [] })),
      persistAuditLog: async () => undefined,
    });
    const token = (role) => app.jwt.sign({ userId: 'test-user', username: 'test', role, isFirstLogin: false });
    const headers = { authorization: `Bearer ${token('leader')}` };
    const payload = { contest_name: 'Festival Sintetis', scope: 'national', status: 'completed', event_year: 2020, deadline: null };
    const created = await app.inject({ method: 'POST', url: '/api/contests', headers, payload });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(created.json().data.deadline, null);
    const id = created.json().data.id;
    const updateHeaders = { ...headers, 'x-change-reason': 'Pengujian sintetis' };
    const update = await app.inject({ method: 'PUT', url: `/api/contests/${id}`, headers: updateHeaders, payload: { status: 'judging', deadline: '2099-12-01' } });
    assert.equal(update.statusCode, 200, update.body);
    const clear = await app.inject({ method: 'PUT', url: `/api/contests/${id}`, headers: updateHeaders, payload: { status: 'judging', deadline: null } });
    assert.equal(clear.statusCode, 200, clear.body);
    assert.equal(clear.json().data.deadline, null);
    const invalid = await app.inject({ method: 'POST', url: '/api/contests', headers, payload: { ...payload, status: 'open' } });
    assert.equal(invalid.statusCode, 422, invalid.body);
    const forbidden = await app.inject({ method: 'PUT', url: `/api/contests/${id}`, headers: { authorization: `Bearer ${token('member')}`, 'x-change-reason': 'Pengujian sintetis' }, payload: { status: 'judging', deadline: null } });
    assert.equal(forbidden.statusCode, 403, forbidden.body);
    const anonymous = await app.inject({ method: 'GET', url: '/api/contests' });
    assert.equal(anonymous.statusCode, 401);
    console.log('CANDIDATE_IMAGE_SYNTHETIC_API_OK');
  } finally {
    await app.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
