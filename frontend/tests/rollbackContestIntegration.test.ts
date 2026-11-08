import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import Fastify from '../../backend/node_modules/fastify/fastify.js';
import jwt from '../../backend/node_modules/@fastify/jwt/index.js';
import rollbackRoutes from '../../backend/src/modules/contests/contests.routes';
import { ContestsService } from '../../backend/src/modules/contests/contests.service';
import { createContestsRepository } from '../../backend/src/modules/contests/contests.repository';
import { decodeContestListResponse } from '../src/features/contests/api/contests.responses';
import { contestEditSchema } from '../src/features/contests/schemas/contestSchema';
import { rollbackDeadlinePatch } from '../src/features/contests/utils/rollbackDeadline';

test('hotfix null deadline can be read and edited by rollback without changing the deadline', async (t) => {
  const hotfixRoot = process.env.ROLLBACK_HOTFIX_DIR;
  assert.ok(hotfixRoot, 'ROLLBACK_HOTFIX_DIR must point to the pinned hotfix checkout');
  const loadHotfix = (file: string) => import(pathToFileURL(resolve(hotfixRoot, 'backend/src/modules/contests', file)).href);
  const [{ default: hotfixRoutes }, { ContestsService: HotfixService }, { createContestsRepository: hotfixRepository }] = await Promise.all([
    loadHotfix('contests.routes.ts'), loadHotfix('contests.service.ts'), loadHotfix('contests.repository.ts'),
  ]);
  const state = { contests: [], submissions: [] } as never;
  const hotfix = Fastify();
  const rollback = Fastify();
  t.after(async () => { await hotfix.close(); await rollback.close(); });
  for (const app of [hotfix, rollback]) await app.register(jwt, { secret: 'isolated-test-secret-long-enough' });
  await hotfix.register(hotfixRoutes, { contestsService: new HotfixService(hotfixRepository(null, state)), persistAuditLog: async () => undefined });
  await rollback.register(rollbackRoutes, { contestsService: new ContestsService(createContestsRepository(null, state)), persistAuditLog: async () => undefined });
  const headers = { authorization: `Bearer ${hotfix.jwt.sign({ userId: 'leader-test', username: 'test', role: 'leader', isFirstLogin: false })}` };
  const created = await hotfix.inject({ method: 'POST', url: '/api/contests', headers, payload: {
    contest_name: 'Festival Sintetis', scope: 'national', deadline: null, status: 'completed', event_year: 2020,
  } });
  assert.equal(created.statusCode, 201, created.body);
  assert.equal(created.json().data.deadline, null);
  assert.equal((await rollback.inject({ method: 'GET', url: '/api/contests' })).statusCode, 401);
  const list = await rollback.inject({ method: 'GET', url: '/api/contests?page=1&pageSize=50', headers });
  assert.equal(list.statusCode, 200, list.body);
  const event = decodeContestListResponse(list.json()).data.find((item) => item.id === created.json().data.id);
  assert.ok(event);
  assert.equal(event.deadline, null);
  assert.equal(contestEditSchema.safeParse({
    nama_lomba: event.nama_lomba, kota: '', tingkat: event.tingkat,
    status: event.status_public, tahun_event: event.tahun_event, deadline: '',
  }).success, true);
  const updated = await rollback.inject({ method: 'PUT', url: `/api/contests/${event.id}`,
    headers: { ...headers, 'x-change-reason': 'Uji rollback sintetis' },
    payload: { city: 'Kota Uji', ...rollbackDeadlinePatch('', event.deadline) },
  });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().data.deadline, null);
});
