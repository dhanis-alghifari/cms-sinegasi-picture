import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import contestAchievementsRoutes from './contest-achievements.routes.js';
import { createContestAchievementsRepository } from './contest-achievements.repository.js';
import { ContestAchievementsService } from './contest-achievements.service.js';

async function createApp() {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(contestAchievementsRoutes, {
    contestAchievementsService: new ContestAchievementsService(
      createContestAchievementsRepository(null, { achievements: [] }),
    ),
  });
  return app;
}

function token(app: FastifyInstance) {
  return app.jwt.sign({ userId: 'contest-team-1', username: 'contest-team', role: 'contest_team', isFirstLogin: false });
}

test('legacy contest result route is read-only and points to pipeline finalization', async (t) => {
  const app = await createApp();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/contest-entries/entry-1/results',
    headers: { authorization: `Bearer ${token(app)}` },
    payload: {
      outcome_status: 'awarded',
      results: [{ result_kind: 'rank', result_title: 'Juara 1', position: 1 }],
      change_reason: 'Hasil lomba diterima',
    },
  });

  assert.equal(response.statusCode, 410);
  assert.equal(response.json().error_code, 'CONTEST_RESULT_LEGACY_DISABLED');
});
