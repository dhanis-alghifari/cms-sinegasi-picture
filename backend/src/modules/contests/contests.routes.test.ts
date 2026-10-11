import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import contestsRoutes from './contests.routes.js';
import { ContestsService } from './contests.service.js';
import { createContestsRepository } from './contests.repository.js';

test('contest routes keep role and capability guards', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(contestsRoutes, {
    contestsService: new ContestsService(createContestsRepository(null, { contests: [], submissions: [] })),
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());

  const member = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const leader = app.jwt.sign({ userId: 'leader-1', username: 'leader', role: 'leader', isFirstLogin: false });
  const contestTeam = app.jwt.sign({ userId: 'contest-1', username: 'contest-team', role: 'contest_team', isFirstLogin: false });
  const deniedCreate = await app.inject({
    method: 'POST',
    url: '/api/contests',
    headers: { authorization: `Bearer ${member}` },
    payload: { name: 'Festival', contest_type: 'Film', level: 'city', date: '2026-10-01' },
  });
  assert.equal(deniedCreate.statusCode, 403);

  const acceptedPublicCreate = await app.inject({
    method: 'POST',
    url: '/api/contests',
    headers: { authorization: `Bearer ${leader}` },
    payload: {
      contest_name: 'Festival Public Contract',
      city: 'Yogyakarta',
      scope: 'west_java',
      deadline: '2026-12-01',
      status: 'open',
      event_year: 2026,
      website_url: 'https://example.test/contest',
    },
  });
  assert.equal(acceptedPublicCreate.statusCode, 201);
  assert.equal(acceptedPublicCreate.json().data.status_public, 'buka');

  const summary = await app.inject({
    method: 'GET',
    url: '/api/contests/summary',
    headers: { authorization: `Bearer ${leader}` },
  });
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json().success, true);
  assert.equal(typeof summary.json().data.totalLomba, 'number');

  const contestId = acceptedPublicCreate.json().data.id as string;
  const missingReasonUpdate = await app.inject({
    method: 'PUT',
    url: `/api/contests/${contestId}`,
    headers: { authorization: `Bearer ${leader}` },
    payload: { city: 'Bekasi' },
  });
  assert.equal(missingReasonUpdate.statusCode, 422);
  assert.equal(missingReasonUpdate.json().error_code, 'CONTEST_UPDATE_REASON_REQUIRED');

  const acceptedUpdate = await app.inject({
    method: 'PUT',
    url: `/api/contests/${contestId}`,
    headers: { authorization: `Bearer ${leader}`, 'x-change-reason': 'Memperbarui kota event' },
    payload: { city: 'Bekasi' },
  });
  assert.equal(acceptedUpdate.statusCode, 200);

  const acceptedSubmit = await app.inject({
    method: 'POST',
    url: '/api/contests/submissions',
    headers: { authorization: `Bearer ${contestTeam}` },
    payload: { contest_id: 'cnt-001', film_id: 'film-1' },
  });
  assert.equal(acceptedSubmit.statusCode, 201);

  const acceptedRichSubmit = await app.inject({
    method: 'POST',
    url: '/api/contests/submissions',
    headers: { authorization: `Bearer ${contestTeam}` },
    payload: {
      contest_id: 'cnt-001',
      film_title: 'Film Frontend',
      director_id: 'student-1',
      video_url: 'https://example.test/video',
      award_status: 'participant',
    },
  });
  assert.equal(acceptedRichSubmit.statusCode, 201);

  const deniedMemberSubmit = await app.inject({
    method: 'POST',
    url: '/api/contests/submissions',
    headers: { authorization: `Bearer ${member}` },
    payload: { contest_id: 'cnt-001', film_id: 'film-2' },
  });
  assert.equal(deniedMemberSubmit.statusCode, 403);
});
