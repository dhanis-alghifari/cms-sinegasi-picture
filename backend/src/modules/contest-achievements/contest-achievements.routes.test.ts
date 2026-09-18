import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import contestAchievementsRoutes from './contest-achievements.routes.js';
import { createContestAchievementsRepository } from './contest-achievements.repository.js';
import { ContestAchievementsService } from './contest-achievements.service.js';
import type { ContestAchievementsMemoryState } from './contest-achievements.types.js';

async function createApp(state: ContestAchievementsMemoryState = { achievements: [] }) {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(contestAchievementsRoutes, {
    contestAchievementsService: new ContestAchievementsService(
      createContestAchievementsRepository(null, state),
    ),
  });
  return app;
}

test('contest readers can open completed achievement details', async (t) => {
  const app = await createApp({
    achievements: [{
      entry_id: 'entry-1',
      contest_id: 'contest-1',
      work_id: 'work-1',
      pipeline_status: 'selesai',
      outcome_status: 'not_awarded',
      work_title: 'Film Dokumenter',
      work_type_code: 'documentary',
      nama_lomba: 'Festival Sekolah',
      kota: 'Bekasi',
      tahun_event: 2026,
      evidence_count: 1,
      awards: [],
      result_title: 'Tidak mendapat penghargaan',
    }],
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/contest-achievements/entry-1',
    headers: { authorization: `Bearer ${token(app)}` },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.entry.work.title, 'Film Dokumenter');
  assert.equal(response.json().data.entry.pipeline_status, 'selesai');
});

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
