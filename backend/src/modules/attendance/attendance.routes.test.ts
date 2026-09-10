import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import attendanceRoutes from './attendance.routes.js';

test('attendance routes keep authenticated list and summary response envelopes', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  let correctionInput: Record<string, unknown> | undefined;
  let listInput: Record<string, unknown> | undefined;
  let summaryInput: Record<string, unknown> | undefined;
  const attendanceService = {
    repositoryIsConfigured: () => false,
    list: async (query: Record<string, unknown>) => {
      listInput = query;
      return {
      data: [{
        id: 'att-1',
        student_id: 'student-1',
        student_nis: '001',
        student_nama: 'Ari',
        kelas: 'X TKJ',
        tanggal: '2026-08-13',
        status: 'hadir',
        keterangan: null,
        is_locked: false,
        idempotency_key: 'attendance-1',
        created_by: 'teacher-1',
        created_at: '2026-08-13T07:00:00.000Z',
        updated_by: null,
        updated_at: null,
      }],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      };
    },
    roster: async () => ({
      data: [{ student_id: 'student-1', nis: '001', nama: 'Ari', kelas: 'X TKJ' }],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }),
    summary: async (query: Record<string, unknown>) => {
      summaryInput = query;
      return { hadir: 1, sakit: 0, izin: 0, alpha: 0, total: 1 };
    },
    record: async () => ({ id: 'att-1', status: 'hadir' }),
    batchRecord: async () => ({
      data: [{ id: 'att-1', student_id: 'student-1', status: 'hadir' }],
      total: 1,
      tanggal: '2026-08-13',
      kelas: 'X',
    }),
    correct: async (input: Record<string, unknown>) => {
      correctionInput = input;
      return { id: 'att-1', status: 'sakit' };
    },
  } as any;
  await app.register(attendanceRoutes, {
    attendanceService,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());

  const token = app.jwt.sign({
    userId: 'usr-1', username: 'teacher', role: 'teacher', isFirstLogin: false,
  });
  const headers = { authorization: `Bearer ${token}` };
  const list = await app.inject({
    method: 'GET',
    url: '/api/attendance?page=1&pageSize=50&student_id=student-1&date_from=2026-08-01&date_to=2026-08-31',
    headers,
  });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().success, true);
  assert.equal(list.json().total, 1);
  assert.equal(list.json().data[0].student_nama, 'Ari');
  assert.equal(list.json().data[0].student_nis, '001');
  assert.equal(list.json().data[0].kelas, 'X TKJ');
  assert.equal('students' in list.json().data[0], false);
  assert.equal(listInput?.student_id, 'student-1');
  assert.equal(listInput?.date_from, '2026-08-01');
  assert.equal(listInput?.date_to, '2026-08-31');

  const summary = await app.inject({
    method: 'GET',
    url: '/api/attendance/summary?student_id=student-1&date_from=2026-08-01&date_to=2026-08-31',
    headers,
  });
  assert.equal(summary.statusCode, 200);
  assert.equal(summary.json().persentaseKehadiran, 100);
  assert.equal(summaryInput?.student_id, 'student-1');
  assert.equal(summaryInput?.date_from, '2026-08-01');
  assert.equal(summaryInput?.date_to, '2026-08-31');

  const roster = await app.inject({ method: 'GET', url: '/api/attendance/roster?tanggal=2026-08-13&kelas=X&pageSize=10', headers });
  assert.equal(roster.statusCode, 200);
  assert.equal(roster.json().data[0].student_id, 'student-1');

  const batch = await app.inject({
    method: 'POST',
    url: '/api/attendance/batch',
    headers,
    payload: {
      tanggal: '2026-08-13',
      kelas: 'X',
      records: [{ student_id: 'student-1', status: 'hadir' }],
    },
  });
  assert.equal(batch.statusCode, 201);
  assert.equal(batch.json().total, 1);

  const legacyBatch = await app.inject({
    method: 'POST',
    url: '/api/attendance',
    headers,
    payload: {
      tanggal: '2026-08-13',
      kelas: 'X',
      records: [{ student_id: 'student-1', status: 'hadir' }],
    },
  });
  assert.equal(legacyBatch.statusCode, 201);
  assert.equal(legacyBatch.json().total, 1);

  const correction = await app.inject({
    method: 'PATCH',
    url: '/api/attendance/att-1/correct',
    headers: { ...headers, 'x-change-reason': 'Surat sakit terlambat diserahkan' },
    payload: {
      attendance_id: 'att-1',
      status: 'sakit',
      keterangan: 'Surat sakit',
    },
  });
  assert.equal(correction.statusCode, 200);
  assert.equal(correction.json().success, true);
  assert.equal(correctionInput?.attendanceId, 'att-1');
  assert.equal(correctionInput?.changeReason, 'Surat sakit terlambat diserahkan');
});

test('attendance write route rejects incomplete payloads at the HTTP boundary', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(attendanceRoutes, {
    attendanceService: {} as any,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());

  const token = app.jwt.sign({
    userId: 'usr-1', username: 'teacher', role: 'teacher', isFirstLogin: false,
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/attendance',
    headers: { authorization: `Bearer ${token}` },
    payload: { student_id: 'student-1' },
  });
  assert.equal(response.statusCode, 400);
});

test('attendance batch route rejects a payload that does not match the batch contract', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(attendanceRoutes, {
    attendanceService: {} as any,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());

  const token = app.jwt.sign({
    userId: 'usr-1', username: 'teacher', role: 'teacher', isFirstLogin: false,
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/attendance/batch',
    headers: { authorization: `Bearer ${token}` },
    payload: { tanggal: '2026-08-13', kelas: 'X' },
  });
  assert.equal(response.statusCode, 400);
});
