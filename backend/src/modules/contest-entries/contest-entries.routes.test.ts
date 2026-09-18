import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import contestEntriesRoutes from './contest-entries.routes.js';
import { ContestEntriesService } from './contest-entries.service.js';
import { createContestEntriesRepository } from './contest-entries.repository.js';
import type { ContestEvidenceStorage } from './contest-entries.types.js';

const storage: ContestEvidenceStorage = {
  createUpload: (fileName, folder) => ({ uploadUrl: 'https://upload.example.test/signed', key: `${folder}/${fileName}`, expiresInSeconds: 900 }),
  inspect: async () => ({ exists: true }),
  createAccess: () => ({ accessUrl: 'https://download.example.test/signed', expiresInSeconds: 900 }),
};

test('contest entry routes expose generic work create, list, and transition flow', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  const state = { works: [], entries: [], evidence: [], statusHistory: [] };
  await app.register(contestEntriesRoutes, {
    contestEntriesService: new ContestEntriesService(createContestEntriesRepository(null, state), storage),
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());

  const token = app.jwt.sign({ userId: 'contest-1', username: 'contest-team', role: 'contest_team', isFirstLogin: false });
  const headers = { authorization: `Bearer ${token}`, 'x-change-reason': 'Kelola karya event', 'x-idempotency-key': 'contest-route-operation-001' };
  const workTypes = await app.inject({ method: 'GET', url: '/api/contest-work-types', headers });
  assert.equal(workTypes.statusCode, 200);
  assert.equal(workTypes.json().data.find((item: { code: string }) => item.code === 'short_film').label, 'Film Pendek');
  const created = await app.inject({
    method: 'POST',
    url: '/api/contests/event-1/entries',
    headers,
    payload: { work: { title: 'Foto Festival', work_type_code: 'photography', primary_asset_url: 'https://example.test/foto.jpg' } },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().data.work.work_type_code, 'photography');

  const listed = await app.inject({ method: 'GET', url: '/api/contests/event-1/entries?page=1&pageSize=10', headers });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().total, 1);

  const entryId = created.json().data.id as string;
  const reservation = await app.inject({
    method: 'POST',
    url: `/api/contest-entries/${entryId}/evidence-uploads`,
    headers,
    payload: { target_status: 'submitted', file_name: 'email.png', content_type: 'image/png', file_size_bytes: 128 },
  });
  assert.equal(reservation.statusCode, 201);
  const transitioned = await app.inject({
    method: 'POST',
    url: `/api/contest-entries/${entryId}/transitions`,
    headers,
    payload: { status: 'submitted', evidence_id: reservation.json().data.evidence_id, change_reason: 'Bukti email diterima' },
  });
  assert.equal(transitioned.statusCode, 200);
  assert.equal(transitioned.json().data.pipeline_status, 'sudah_terkirim');

  // Read access is available to contest readers, but only after the entry is
  // completed and the evidence is attached.
  (state.entries[0] as any).pipeline_status = 'selesai';
  const evidenceAccess = await app.inject({
    method: 'GET',
    url: `/api/contest-evidence/${reservation.json().data.evidence_id}/access`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(evidenceAccess.statusCode, 200);
  assert.equal(evidenceAccess.json().data.access_url, 'https://download.example.test/signed');
});

test('member cannot submit contest entries without the contest submit capability', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(contestEntriesRoutes, {
    contestEntriesService: {} as any,
    persistAuditLog: async () => undefined,
  });
  t.after(() => app.close());
  const token = app.jwt.sign({ userId: 'member-1', username: 'member', role: 'member', isFirstLogin: false });
  const response = await app.inject({
    method: 'POST',
    url: '/api/contests/event-1/entries',
    headers: { authorization: `Bearer ${token}` },
    payload: { work: { title: 'Tidak boleh', work_type_code: 'photography' } },
  });
  assert.equal(response.statusCode, 403);
});
