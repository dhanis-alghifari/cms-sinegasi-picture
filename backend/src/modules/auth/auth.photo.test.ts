import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { createClient } from '@supabase/supabase-js';
import { USER_ROLE_VALUES, type JwtPayload } from '../../shared/auth/auth.types.js';
import { createAuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import authRoutes from './auth.routes.js';

const userId = '11111111-1111-4111-8111-111111111111';
const otherStudentId = '22222222-2222-4222-8222-222222222222';
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';

async function createApp(t: TestContext, rows: unknown = [{ id: 'own-student', is_active: true, foto_url: photo }], status = 200) {
  const queries: URL[] = [];
  const client = createClient('https://database.example.test', 'synthetic-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      queries.push(url);
      assert.equal(url.pathname, '/rest/v1/students');
      assert.equal(init?.method, 'GET');
      assert.equal(url.searchParams.get('user_id'), `eq.${userId}`);
      assert.equal(url.searchParams.get('select'), 'id,is_active,foto_url');
      return Response.json(rows, { status });
    } },
  });
  const app = Fastify();
  await app.register(jwt, { secret: 'synthetic-photo-test-secret-not-for-production' });
  await app.register(authRoutes, {
    authService: new AuthService(createAuthRepository(client), false),
    loginRateLimiter: { isLimited: () => false, recordFailure: () => undefined, clear: () => undefined },
  });
  t.after(() => app.close());
  function headers(role: JwtPayload['role'] = 'member', isFirstLogin = false) {
    return { authorization: `Bearer ${app.jwt.sign({ userId, username: 'fixture', role, isFirstLogin, studentId: otherStudentId })}` };
  }
  return { app, headers, queries };
}

test('own photo requires authentication and a completed password change before querying', async (t) => {
  const { app, headers, queries } = await createApp(t);
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me/photo' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me/photo', headers: headers('member', true) })).statusCode, 403);
  assert.equal(queries.length, 0);
});

test('every role can read only its linked photo, ignoring stale JWT or supplied student IDs', async (t) => {
  const { app, headers, queries } = await createApp(t);
  for (const role of USER_ROLE_VALUES) {
    const response = await app.inject({ method: 'GET', url: `/api/auth/me/photo?studentId=${otherStudentId}`, headers: headers(role) });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'image/png');
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.deepEqual(response.rawPayload, Buffer.from(photo.split(',')[1], 'base64'));
  }
  assert.equal(queries.length, USER_ROLE_VALUES.length);
});

test('unlinked accounts and missing, invalid or legacy public photos return an empty private response', async (t) => {
  for (const rows of [[], [{ id: 'own-student', is_active: true, foto_url: null }], [{ id: 'own-student', is_active: true, foto_url: 'https://example.test/portrait.jpg' }], [{ id: 'own-student', is_active: true, foto_url: 'data:image/svg+xml,<svg/>' }]]) {
    const { app, headers } = await createApp(t, rows);
    const response = await app.inject({ method: 'GET', url: '/api/auth/me/photo', headers: headers('teacher') });
    assert.equal(response.statusCode, 204);
    assert.equal(response.body, '');
    assert.equal(response.headers['cache-control'], 'private, no-store');
  }
});

test('inactive links and unavailable or ambiguous lookups fail closed without provider details', async (t) => {
  for (const fixture of [
    { rows: [{ id: 'own-student', is_active: false, foto_url: photo }], status: 200, expected: 401 },
    { rows: { code: '57014', message: 'private-provider-detail' }, status: 503, expected: 503 },
    { rows: [{ id: 'one', is_active: true, foto_url: photo }, { id: 'two', is_active: true, foto_url: photo }], status: 200, expected: 503 },
  ]) {
    const { app, headers } = await createApp(t, fixture.rows, fixture.status);
    const response = await app.inject({ method: 'GET', url: '/api/auth/me/photo', headers: headers() });
    assert.equal(response.statusCode, fixture.expected);
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.ok(!response.body.includes('private-provider-detail'));
    assert.ok(!response.body.includes(photo));
  }
});
