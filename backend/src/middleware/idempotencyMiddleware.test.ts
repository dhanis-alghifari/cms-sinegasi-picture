import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryIdempotencyStore, createSupabaseIdempotencyStore } from './idempotencyMiddleware.js';

test('memory idempotency store expires and replaces responses by cache key', async () => {
  const store = createMemoryIdempotencyStore();
  const now = Date.now();
  store.set('same-request', { statusCode: 201, payload: '{"ok":true}', expiresAt: now + 1_000 });
  assert.equal((await store.get('same-request', now + 500))?.statusCode, 201);
  assert.equal(await store.get('same-request', now + 1_000), null);
});

test('Supabase idempotency adapter falls back cleanly when no client is configured', async () => {
  const fallback = createMemoryIdempotencyStore();
  const store = createSupabaseIdempotencyStore(null, fallback);
  store.set('fallback-request', { statusCode: 200, payload: 'ok', expiresAt: Date.now() + 1_000 });
  assert.equal((await store.get('fallback-request'))?.payload, 'ok');
});
