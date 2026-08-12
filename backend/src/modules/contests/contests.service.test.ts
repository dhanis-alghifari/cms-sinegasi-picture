import assert from 'node:assert/strict';
import test from 'node:test';
import { createContestsRepository } from './contests.repository.js';
import { ContestsService, ContestsServiceError } from './contests.service.js';

test('contest service supports list, create, update, and submission in memory', async () => {
  const service = new ContestsService(createContestsRepository(null, { contests: [], submissions: [] }));
  const initial = await service.list({});
  assert.equal(initial.total, 2);

  const created = await service.create({ nama: 'Festival Baru', jenis: 'Short Film', level: 'kota', tanggal: '2026-10-01' }, 'leader-1');
  assert.equal(created.status, 'progres');
  const updated = await service.update(created.id, { status: 'selesai', hasil: 'Juara 1' }, 'leader-1');
  assert.equal(updated.status, 'selesai');

  const submission = await service.submit({ contest_id: created.id, film_id: 'film-1' }, 'member-1');
  assert.equal(submission.contest_id, created.id);
});

test('contest service validates dates, empty updates, and duplicate submissions', async () => {
  const service = new ContestsService(createContestsRepository(null, { contests: [], submissions: [] }));
  await assert.rejects(
    () => service.create({ nama: 'A', jenis: 'Film', level: 'kota', tanggal: 'tomorrow' }, 'leader-1'),
    (error: unknown) => error instanceof ContestsServiceError && error.statusCode === 422,
  );
  await assert.rejects(() => service.update('missing', {}, 'leader-1'), (error: unknown) => error instanceof ContestsServiceError && error.statusCode === 422);
  await service.submit({ contest_id: 'cnt-001', film_id: 'film-1' }, 'member-1');
  await assert.rejects(
    () => service.submit({ contest_id: 'cnt-001', film_id: 'film-1' }, 'member-1'),
    (error: unknown) => error instanceof ContestsServiceError && error.statusCode === 409,
  );
});

test('contest service normalizes the frontend contract without dropping legacy fields', async () => {
  const service = new ContestsService(createContestsRepository(null, { contests: [], submissions: [] }));
  const created = await service.create({
    nama_lomba: 'Festival Film Pelajar',
    penyelenggara: 'Dinas Pendidikan',
    tingkat: 'Nasional',
    deadline: '2026-12-01',
    status: 'buka',
    website_url: 'https://example.test/contest',
    deskripsi: 'Kompetisi film pelajar',
  }, 'leader-1');

  assert.equal(created.nama, 'Festival Film Pelajar');
  assert.equal(created.nama_lomba, 'Festival Film Pelajar');
  assert.equal(created.level, 'nasional');
  assert.equal(created.tanggal, '2026-12-01');
  assert.equal(created.status, 'progres');
  assert.equal(created.status_public, 'buka');

  const submission = await service.submit({
    contest_id: created.id,
    judul_film: 'Film Baru',
    sutradara_id: 'student-1',
    link_video: 'https://example.test/video',
    award_status: 'Peserta',
    crew_members: ['Editor'],
  }, 'member-1');
  assert.equal(submission.judul_film, 'Film Baru');
  assert.equal(submission.film_id, null);

  const summary = await service.summary();
  assert.equal(summary.totalLomba, 3);
  assert.equal(summary.totalKaryaSubmitted, 1);
});
