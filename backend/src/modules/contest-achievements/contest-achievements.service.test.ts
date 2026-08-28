import assert from 'node:assert/strict';
import test from 'node:test';
import { createContestAchievementsRepository } from './contest-achievements.repository.js';
import { ContestAchievementsService, ContestAchievementsServiceError } from './contest-achievements.service.js';
import type { ContestAchievementsMemoryState } from './contest-achievements.types.js';

test('contest achievements service accepts multiple normalized awards', async () => {
  const state: ContestAchievementsMemoryState = { achievements: [] };
  const service = new ContestAchievementsService(createContestAchievementsRepository(null, state));
  const result = await service.record('entry-1', {
    outcome_status: 'awarded',
    results: [
      { result_kind: 'rank', result_title: 'Juara 3', position: 3 },
      { result_kind: 'special_award', result_title: 'Best Cinematography', category_name: 'Sinematografi' },
    ],
    change_reason: 'Hasil juri sudah diterima',
  }, 'teacher-1');
  assert.equal((result as { idempotent_replay: boolean }).idempotent_replay, false);
  assert.equal(state.achievements.length, 2);
  assert.equal(state.achievements[0]?.outcome_status, 'awarded');
});

test('contest achievements service requires an award row for awarded outcome', async () => {
  const service = new ContestAchievementsService(createContestAchievementsRepository(null, { achievements: [] }));
  await assert.rejects(
    () => service.record('entry-1', { outcome_status: 'awarded', results: [], change_reason: 'Hasil juri' }, 'teacher-1'),
    (error: unknown) => error instanceof ContestAchievementsServiceError && error.errorCode === 'CONTEST_RESULT_REQUIRED',
  );
});

test('contest achievements service maps invalid filters before repository access', async () => {
  const service = new ContestAchievementsService(createContestAchievementsRepository(null, { achievements: [] }));
  await assert.rejects(
    () => service.list({ result_kind: 'winner' }),
    (error: unknown) => error instanceof ContestAchievementsServiceError && error.errorCode === 'CONTEST_RESULT_KIND_INVALID',
  );
});
