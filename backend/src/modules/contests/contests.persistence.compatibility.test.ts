import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupContestSubmissions,
  mapContestPersistenceRow,
  toContestInsertRow,
} from './contests.persistence.compatibility.js';

test('contest persistence compatibility writes required legacy aliases beside the public contract', () => {
  const row = toContestInsertRow({
    nama: 'Festival Film Pelajar',
    jenis: 'Festival / Perlombaan',
    level: 'provinsi',
    tanggal: '2026-12-01',
    status: 'progres',
    hasil: null,
    namaLomba: 'Festival Film Pelajar',
    penyelenggara: 'Sinegasi',
    kota: 'Bekasi',
    tingkat: 'jawa_barat',
    deadline: '2026-12-01',
    tahunEvent: 2026,
    statusPublic: 'buka',
    websiteUrl: null,
    deskripsi: null,
    plannedWorkCount: null,
    academicYear: '2026',
    actorId: 'user-1',
  });

  assert.deepEqual(row, {
    nama: 'Festival Film Pelajar',
    nama_festival: 'Festival Film Pelajar',
    jenis: 'Festival / Perlombaan',
    level: 'provinsi',
    tanggal: '2026-12-01',
    tanggal_lomba: '2026-12-01',
    status: 'progres',
    hasil: null,
    nama_lomba: 'Festival Film Pelajar',
    penyelenggara: 'Sinegasi',
    kota: 'Bekasi',
    tingkat: 'jawa_barat',
    deadline: '2026-12-01',
    tahun_event: 2026,
    status_public: 'buka',
    website_url: null,
    deskripsi: null,
    planned_work_count: null,
    academic_year: '2026',
    created_by: 'user-1',
  });
});

test('contest persistence compatibility maps public fields and merges legacy film submissions', () => {
  const contest = mapContestPersistenceRow({
    id: 'contest-1',
    nama: 'Festival Film Pelajar',
    jenis: 'Festival / Perlombaan',
    level: 'provinsi',
    tanggal: '2026-12-01',
    status: 'progres',
    status_public: 'buka',
    hasil: null,
    nama_lomba: 'Festival Film Pelajar',
    penyelenggara: 'Sinegasi',
    tingkat: 'jawa_barat',
    deadline: '2026-12-01',
    tahun_event: 2026,
  });
  const submissions = groupContestSubmissions(
    [{ id: 'submission-1', contest_id: 'contest-1', film_id: 'film-1', crew_members: [] }],
    [
      { id: 'legacy-duplicate', contest_id: 'contest-1', film_id: 'film-1' },
      { id: 'legacy-unique', contest_id: 'contest-1', film_id: 'film-2' },
    ],
  );

  assert.equal(contest.nama_lomba, 'Festival Film Pelajar');
  assert.equal(contest.tingkat, 'jawa_barat');
  assert.equal(contest.status_public, 'buka');
  assert.deepEqual(submissions.get('contest-1')?.map((submission) => submission.id), [
    'submission-1',
    'legacy-unique',
  ]);
});
