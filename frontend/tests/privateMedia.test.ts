import assert from 'node:assert/strict';
import test from 'node:test';
import { isLocalImagePreview, isPrivateImageEndpoint, mediaSession, privateMediaPathSchema } from '../src/shared/api/privateMedia';
import { requestPrivateImage } from '../src/shared/api/privateImageResponse';
import { isCurrentPrivateImageLease, leasePrivateImage } from '../src/shared/api/privateImageLease';
import { createPrivateImageQueue } from '../src/shared/api/privateImageQueue';
import { decodeAgendaPhotoAccess } from '../src/features/agenda/api/agenda.responses';
import { decodeContestEvidenceAccess } from '../src/features/contests/api/contests.responses';

const endpoint = '/api/private-media/agenda/parent-1/photo-1';
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test('closed and retried image leases cannot reuse a stale preview', () => {
  const lease = { active: true };
  assert.equal(isCurrentPrivateImageLease(lease, 0, 0), true);
  assert.equal(isCurrentPrivateImageLease(lease, 0, 1), false);
  lease.active = false;
  assert.equal(isCurrentPrivateImageLease(lease, 0, 0), false);
});

test('only closed resource paths reach authenticated transport; redirects and bearer destinations are refused', async () => {
  for (const path of ['https://account.r2.cloudflarestorage.com/key?X-Amz-Signature=fixture', '//example.test/file', '/api/private-media/agenda/parent-1/photo-1?token=fixture', '/api/private-media/agenda/parent-1/../key', '/api/private-media/unknown/parent-1/photo-1', '/api/private-media/agenda/parent-1/a%2Fb']) {
    assert.equal(isPrivateImageEndpoint(path), false);
    await assert.rejects(() => requestPrivateImage(path, async () => { assert.fail('must reject before credentials or request'); }));
  }
  assert.equal(isPrivateImageEndpoint(endpoint), true);
  assert.equal(isPrivateImageEndpoint('/api/students/student-1/photo'), true);
  assert.equal(isPrivateImageEndpoint('/api/equipment/eq-1/photo'), true);
  assert.equal(isPrivateImageEndpoint('/api/auth/me/photo'), true);
  for (const path of ['/api/auth/other/photo', '/api/auth/me/photo?studentId=other', '/api/auth/me/photo/extra']) {
    assert.equal(isPrivateImageEndpoint(path), false);
  }
  assert.equal(privateMediaPathSchema.safeParse('https://public.example.test/file').success, false);
  const result = await requestPrivateImage(endpoint, async (path, options) => {
    assert.equal(path, endpoint);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
  }, { redirect: 'follow', method: 'POST' });
  assert.equal(result?.blob.size, 4);
});

test('legacy JSON read URLs, SVG, redirects, empty and oversized responses fail closed', async () => {
  for (const response of [
    Response.json({ url: 'https://public.example.test/file' }),
    new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
    new Response(new Uint8Array(), { headers: { 'content-type': 'image/png' } }),
    new Response(new Uint8Array(5 * 1024 * 1024 + 1), { headers: { 'content-type': 'image/png' } }),
  ]) await assert.rejects(() => requestPrivateImage(endpoint, async () => response));
  const redirected = new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } });
  Object.defineProperty(redirected, 'redirected', { value: true });
  await assert.rejects(() => requestPrivateImage(endpoint, async () => redirected));
  assert.equal(await requestPrivateImage(endpoint, async () => new Response(null, { status: 204 })), null);
});

test('API consumers decode authenticated references and zero TTL, rejecting signed GET fallback', () => {
  const value = { success: true, data: { access_url: endpoint, expires_in_seconds: 0 } };
  assert.equal(decodeAgendaPhotoAccess(value).access_url, endpoint);
  assert.equal(decodeContestEvidenceAccess(value).expires_in_seconds, 0);
  assert.throws(() => decodeAgendaPhotoAccess({ success: true, data: { access_url: 'https://bucket.example.test/signed', expires_in_seconds: 900 } }));
  assert.equal(isLocalImagePreview('data:image/png;base64,aGVsbG8='), true);
  assert.equal(isLocalImagePreview('data:image/svg+xml,<svg/>'), false);
  assert.equal(isLocalImagePreview('https://public.example.test/file'), false);
});

test('one-view blob lease revokes on disposal and never publishes after cancellation or session change', async (t) => {
  const created: string[] = [];
  const revoked: string[] = [];
  t.mock.method(URL, 'createObjectURL', () => { const url = `blob:offline-${created.length}`; created.push(url); return url; });
  t.mock.method(URL, 'revokeObjectURL', (url: string) => { revoked.push(url); });
  const blob = new Blob(['offline-image'], { type: 'image/png' });
  const results: Array<{ url: string | null; failed: boolean }> = [];
  let signal: AbortSignal | undefined;
  const dispose = leasePrivateImage(async (value) => { signal = value; return { kind: 'blob', blob }; }, (value) => results.push(value), () => true);
  await tick();
  assert.equal(results[0]?.url, created[0]);
  dispose(); dispose();
  assert.equal(signal?.aborted, true);
  assert.deepEqual(revoked, created);
  let resolve: (value: { kind: 'blob'; blob: Blob }) => void = () => undefined;
  const late = leasePrivateImage(() => new Promise((done) => { resolve = done; }), (value) => results.push(value), () => true);
  late(); resolve({ kind: 'blob', blob }); await tick();
  assert.equal(created.length, 1);
  const stale = leasePrivateImage(async () => ({ kind: 'blob', blob }), (value) => results.push(value), () => false);
  await tick(); stale();
  assert.equal(results.length, 1);
});

test('media generations notify logout/token changes without retaining credentials or object URLs', () => {
  const before = mediaSession.snapshot();
  let notifications = 0;
  const unsubscribe = mediaSession.subscribe(() => { notifications += 1; });
  mediaSession.invalidate();
  assert.equal(mediaSession.snapshot(), before + 1);
  unsubscribe(); mediaSession.invalidate();
  assert.equal(notifications, 1);
});

test('self portrait uses the private transport and discards a late response after an account change', async (t) => {
  const selfPortrait = '/api/auth/me/photo';
  const created: string[] = [];
  const revoked: string[] = [];
  t.mock.method(URL, 'createObjectURL', () => { const url = `blob:self-${created.length}`; created.push(url); return url; });
  t.mock.method(URL, 'revokeObjectURL', (url: string) => { revoked.push(url); });
  const load = (signal: AbortSignal) => requestPrivateImage(selfPortrait, async (path, options) => {
    assert.equal(path, selfPortrait);
    assert.equal(options.signal, signal);
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
  }, { signal });
  const results: Array<{ url: string | null; failed: boolean }> = [];
  const firstSession = mediaSession.snapshot();
  const dispose = leasePrivateImage(load, (result) => results.push(result), () => mediaSession.snapshot() === firstSession);
  await tick();
  assert.equal(results[0]?.url, 'blob:self-0');
  mediaSession.invalidate();
  dispose();
  assert.deepEqual(revoked, created);
  const stale = leasePrivateImage(load, () => assert.fail('old account must not publish'), () => mediaSession.snapshot() === firstSession);
  await tick();
  stale();
  assert.equal(created.length, 1);
  const noPhoto = leasePrivateImage(async () => null, (result) => results.push(result), () => true);
  await tick();
  noPhoto();
  assert.deepEqual(results.at(-1), { url: null, failed: true });
});

test('bounded image queue limits concurrency, cancels waiters, rejects overflow and releases failed slots', async () => {
  const queue = createPrivateImageQueue(1, 1);
  const running = new AbortController();
  const waiting = new AbortController();
  let finish: () => void = () => undefined;
  const first = queue.run(running.signal, () => new Promise<void>((resolve) => { finish = resolve; }));
  await tick();
  const second = queue.run(waiting.signal, async () => { assert.fail('cancelled waiter must not make a request'); });
  await assert.rejects(() => queue.run(new AbortController().signal, async () => undefined), /Antrean/);
  waiting.abort(); await assert.rejects(() => second, { name: 'AbortError' });
  finish(); await first;
  await assert.rejects(() => queue.run(new AbortController().signal, async () => { throw new Error('offline outage'); }), /offline outage/);
  assert.equal(await queue.run(new AbortController().signal, async () => 'next'), 'next');
});
