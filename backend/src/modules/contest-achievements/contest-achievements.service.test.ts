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
  const recap = await service.list({ page: '1', pageSize: '20' });
  assert.equal(recap.total, 1);
  assert.equal(recap.data[0]?.awards.length, 2);
  const detail = await service.getDetail('entry-1');
  assert.equal(detail.entry.id, 'entry-1');
  assert.equal(detail.awards.length, 2);
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

test('contest achievement search matches final outcome and generated rank labels', async () => {
  const service = new ContestAchievementsService(createContestAchievementsRepository(null, {
    achievements: [
      {
        entry_id: 'entry-not-awarded',
        contest_id: 'contest-1',
        work_id: 'work-1',
        pipeline_status: 'selesai',
        outcome_status: 'not_awarded',
        work_title: 'Film A',
        work_type_code: 'short_film',
        nama_lomba: 'Festival Sekolah',
        kota: 'Bekasi',
        tahun_event: 2026,
        evidence_count: 0,
        awards: [],
      },
      {
        entry_id: 'entry-ranked',
        contest_id: 'contest-1',
        work_id: 'work-2',
        pipeline_status: 'selesai',
        outcome_status: 'awarded',
        work_title: 'Film B',
        work_type_code: 'short_film',
        nama_lomba: 'Festival Sekolah',
        kota: 'Bekasi',
        tahun_event: 2026,
        evidence_count: 0,
        awards: [{ id: 'award-1', result_kind: 'rank', result_title: 'Peringkat tiga', position: 3 }],
      },
    ],
  }));

  const notAwarded = await service.list({ search: 'tidak mendapat penghargaan' });
  assert.deepEqual(notAwarded.data.map((row) => row.entry_id), ['entry-not-awarded']);

  const ranked = await service.list({ search: 'juara 3' });
  assert.deepEqual(ranked.data.map((row) => row.entry_id), ['entry-ranked']);
});
