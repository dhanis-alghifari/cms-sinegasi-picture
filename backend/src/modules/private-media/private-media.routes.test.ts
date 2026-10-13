import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { privateMediaRoutes, type PrivateMediaRoutesOptions } from './private-media.routes.js';
import { PRIVATE_MEDIA_KINDS, privateMediaAccess, type PrivateMediaObject } from '../../shared/uploads/privateMedia.js';
import { sendPrivateImageReference } from '../../shared/http/sendPrivateImageReference.js';

const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
const object: PrivateMediaObject = { objectKey: 'validated-v2/private/one.png', contentType: 'image/png', fileSizeBytes: bytes.length };

async function fixture(t: test.TestContext) {
  const app = Fastify();
  await app.register(jwt, { secret: 'private-media-offline-test-secret' });
  let reads = 0;
  let lookups = 0;
  let unavailable = false;
  let deleted = false;
  const resolve = async (parent: string, id: string) => {
    lookups += 1;
    if (deleted || parent !== 'parent-1' || id !== 'evidence-1') throw Object.assign(new Error('Bukti tidak ditemukan.'), { statusCode: 404, errorCode: 'NOT_FOUND' });
    return object;
  };
  const options: PrivateMediaRoutesOptions = {
    agendaService: { photoMedia: resolve }, contestEntriesService: { evidenceMedia: resolve },
    borrowingMutationsService: { repositoryIsConfigured: () => false, returnEvidenceMedia: async (parent, id, actor) => {
      if (actor && !actor.teacher && actor.id !== 'owner-1') throw Object.assign(new Error('Tidak diizinkan.'), { statusCode: 403, errorCode: 'FORBIDDEN' });
      return resolve(parent, id);
    } },
    equipmentRecoveryService: { chargeEvidenceMedia: resolve },
    socialMediaService: { evidenceMedia: async (_kind, parent, id) => resolve(parent, id) },
    readImage: async (value) => { reads += 1; assert.deepEqual(value, object); if (unavailable) throw new Error('secret upstream diagnostics'); return { contentType: 'image/png', body: bytes }; },
  };
  await app.register(privateMediaRoutes, options);
  t.after(() => app.close());
  const headers = (claims: Record<string, unknown> = {}) => ({ authorization: `Bearer ${app.jwt.sign({ userId: 'owner-1', role: 'teacher', isFirstLogin: false, ...claims })}` });
  return { app, headers, counts: () => ({ reads, lookups }), remove: () => { deleted = true; }, outage: () => { unavailable = true; } };
}

test('all seven private media kinds send bytes without signed URLs or shared caching; repeated requests reauthorize', async (t) => {
  const f = await fixture(t);
  for (const kind of PRIVATE_MEDIA_KINDS) {
    const response = await f.app.inject({ url: privateMediaAccess(kind, 'parent-1', 'evidence-1').access_url, headers: f.headers() });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.rawPayload, bytes);
    assert.equal(response.headers['content-type'], 'image/png');
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.equal(response.headers.vary, 'Authorization');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers.location, undefined);
  }
  assert.deepEqual(f.counts(), { reads: 7, lookups: 7 });
  f.remove();
  assert.equal((await f.app.inject({ url: '/api/private-media/agenda/parent-1/evidence-1', headers: f.headers() })).statusCode, 404);
  assert.deepEqual(f.counts(), { reads: 7, lookups: 8 });
});

test('copied media paths, forged/expired tokens and first-login sessions never reach storage', async (t) => {
  const f = await fixture(t);
  const url = '/api/private-media/agenda/parent-1/evidence-1';
  assert.equal((await f.app.inject({ url })).statusCode, 401);
  assert.equal((await f.app.inject({ url, headers: { authorization: 'Bearer fabricated' } })).statusCode, 401);
  assert.equal((await f.app.inject({ url, headers: f.headers({ exp: Math.floor(Date.now() / 1000) - 1 }) })).statusCode, 401);
  assert.equal((await f.app.inject({ url, headers: f.headers({ isFirstLogin: true }) })).statusCode, 403);
  assert.deepEqual(f.counts(), { reads: 0, lookups: 0 });
});

test('module capabilities, report ownership and parent/attachment linkage cannot be bypassed', async (t) => {
  const f = await fixture(t);
  for (const kind of PRIVATE_MEDIA_KINDS.filter((kind) => kind !== 'return-report')) {
    const response = await f.app.inject({ url: privateMediaAccess(kind, 'parent-1', 'evidence-1').access_url, headers: f.headers({ role: 'member' }) });
    assert.equal(response.statusCode, 403, kind);
  }
  assert.equal((await f.app.inject({ url: '/api/private-media/return-report/parent-1/evidence-1', headers: f.headers({ role: 'member', userId: 'other-1' }) })).statusCode, 403);
  assert.equal((await f.app.inject({ url: '/api/private-media/return-report/parent-1/evidence-1', headers: f.headers({ role: 'member' }) })).statusCode, 200);
  assert.equal((await f.app.inject({ url: '/api/private-media/agenda/other-parent/evidence-1', headers: f.headers() })).statusCode, 404);
  assert.equal((await f.app.inject({ url: '/api/private-media/agenda/parent-1/other-evidence', headers: f.headers() })).statusCode, 404);
  assert.equal(f.counts().reads, 1);
});

test('arbitrary destinations, storage keys and unknown kinds are not proxy inputs; outages are sanitized', async (t) => {
  const f = await fixture(t);
  for (const url of ['/api/private-media/arbitrary/parent-1/evidence-1', '/api/private-media/agenda/parent-1/https%3A%2F%2F127.0.0.1', '/api/private-media/agenda/parent-1/%2E%2E', '/api/private-media/agenda/parent-1/folder%2Fkey']) {
    const response = await f.app.inject({ url, headers: f.headers() });
    assert.ok([400, 404].includes(response.statusCode));
  }
  assert.equal(f.counts().reads, 0);
  f.outage();
  const response = await f.app.inject({ url: '/api/private-media/agenda/parent-1/evidence-1', headers: f.headers() });
  assert.equal(response.statusCode, 503);
  assert.doesNotMatch(response.body, /secret|upstream|validated-v2|X-Amz/);
});

test('legacy portrait URL is neither returned nor fetched, while valid inline bytes remain private', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  app.get('/legacy', (_request, reply) => sendPrivateImageReference(reply, 'https://public.example.test/private-photo.png', 1024));
  app.get('/inline', (_request, reply) => sendPrivateImageReference(reply, `data:image/png;base64,${bytes.toString('base64')}`, 1024));
  const legacy = await app.inject({ url: '/legacy' });
  assert.equal(legacy.statusCode, 204);
  assert.equal(legacy.body, '');
  assert.equal(legacy.headers.location, undefined);
  const inline = await app.inject({ url: '/inline' });
  assert.deepEqual(inline.rawPayload, bytes);
  assert.equal(inline.headers['cache-control'], 'private, no-store');
});
