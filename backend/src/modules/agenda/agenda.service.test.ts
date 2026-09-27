import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgendaRepository } from './agenda.repository.js';
import { AgendaService, AgendaServiceError } from './agenda.service.js';
import { getJakartaDate } from './agenda.helpers.js';

function yesterday(): string {
  const date = new Date(`${getJakartaDate()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date(`${getJakartaDate()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

test('agenda service creates, searches, updates, and archives activities in memory', async () => {
  const state = { activities: [] };
  const service = new AgendaService(createAgendaRepository(null, state));
  const activityDate = yesterday();
  const created = await service.create({
    activity_date: activityDate, activity_name: 'Latihan produksi', activity_description: 'Menyusun shot list', instructor_name: 'Bu Guru', pic_names: 'Ketua, Sekretaris', idempotency_key: 'agenda-create-1',
  }, 'leader-1', {});
  assert.equal(created.data.pic_names.length, 2);
  assert.equal((await service.list({ search: 'sekretaris' })).total, 1);
  const updated = await service.update(created.data.id, {
    activity_date: activityDate, activity_name: 'Latihan produksi lanjutan', activity_description: 'Menyusun shot list final', instructor_name: 'Bu Guru', pic_names: ['Ketua'], expected_version: 1, change_reason: 'Koreksi uraian', idempotency_key: 'agenda-update-1',
  }, 'secretary-1', {});
  assert.equal(updated.data.version, 2);
  const archived = await service.archive(updated.data.id, 'Agenda ganda', 'teacher-1', 'agenda-archive-1', {});
  assert.ok(archived.data.archived_at);
  assert.equal((await service.list({})).total, 0);
});

test('agenda service rejects future dates and invalid PIC lists', async () => {
  const service = new AgendaService(createAgendaRepository(null, { activities: [] }));
  await assert.rejects(
    () => service.create({ activity_date: '2099-01-01', activity_name: 'Kegiatan', activity_description: 'Uraian', instructor_name: 'Pengajar', pic_names: 'PIC', idempotency_key: 'agenda-future-1' }, 'leader-1', {}),
    (error: unknown) => error instanceof AgendaServiceError && error.errorCode === 'AGENDA_DATE_INVALID',
  );
  await assert.rejects(
    () => service.create({ activity_date: yesterday(), activity_name: 'Kegiatan', activity_description: 'Uraian', instructor_name: 'Pengajar', pic_names: '\u0000', idempotency_key: 'agenda-pic-1' }, 'leader-1', {}),
    (error: unknown) => error instanceof AgendaServiceError && error.errorCode === 'AGENDA_PIC_INVALID',
  );
  await assert.rejects(
    () => service.archive('missing', 'x', 'teacher-1', 'agenda-archive-short', {}),
    (error: unknown) => error instanceof AgendaServiceError && error.errorCode === 'AGENDA_CHANGE_REASON_INVALID',
  );
  await assert.rejects(
    () => service.list({ date_from: daysAgo(91), date_to: yesterday() }),
    (error: unknown) => error instanceof AgendaServiceError && error.errorCode === 'AGENDA_DATE_RANGE_TOO_LARGE',
  );
});

test('agenda instructor is optional and blank values normalize to null', async () => {
  const service = new AgendaService(createAgendaRepository(null, { activities: [] }));
  const created = await service.create({
    activity_date: yesterday(), activity_name: 'Rapat tim humas', activity_description: 'Menyusun kalender publikasi',
    pic_names: ['Humas'], idempotency_key: 'agenda-no-instructor',
  }, 'humas-1', {});
  assert.equal(created.data.instructor_name, null);
  assert.equal((await service.list({ search: 'rapat' })).total, 1);

  const updated = await service.update(created.data.id, {
    activity_date: yesterday(), activity_name: 'Rapat tim humas', activity_description: 'Menyusun kalender konten',
    instructor_name: '   ', pic_names: ['Humas'], expected_version: 1, change_reason: 'Penyesuaian uraian',
    idempotency_key: 'agenda-no-instructor-update',
  }, 'humas-1', {});
  assert.equal(updated.data.instructor_name, null);
});

test('agenda instructor rejects a nonblank value shorter than two characters', async () => {
  const service = new AgendaService(createAgendaRepository(null, { activities: [] }));
  await assert.rejects(() => service.create({
    activity_date: yesterday(), activity_name: 'Rapat', activity_description: 'Rapat agenda tim',
    instructor_name: 'A', pic_names: ['Humas'], idempotency_key: 'agenda-short-inst',
  }, 'humas-1', {}), (error: unknown) => error instanceof AgendaServiceError && error.errorCode === 'AGENDA_INSTRUCTOR_INVALID');
});

test('agenda report strips private object keys and exposes only signed photo fields', async () => {
  const state = { activities: [] };
  const service = new AgendaService(createAgendaRepository(null, state));
  const created = await service.create({
    activity_date: yesterday(),
    activity_name: 'Dokumentasi kelas',
    activity_description: 'Kegiatan terdokumentasi',
    instructor_name: 'Pengajar',
    pic_names: 'Ketua',
    idempotency_key: 'agenda-report-1',
  }, 'leader-1', {});
  created.data.photo = {
    id: 'photo-1',
    activity_id: created.data.id,
    object_key: 'agenda/private/photo.jpg',
    upload_status: 'attached',
    mime_type: 'image/jpeg',
    file_size_bytes: 1024,
    original_filename: 'photo.jpg',
    created_at: new Date().toISOString(),
  };

  const report = await service.report({});
  assert.equal(report.data.length, 1);
  assert.match(report.data[0]?.photo_access_url ?? '', /^https:\/\//);
  assert.equal(report.data[0]?.photo_access_expires_in_seconds, 900);
  assert.ok(report.data[0]?.photo);
  assert.equal('object_key' in (report.data[0]?.photo ?? {}), false);
});
