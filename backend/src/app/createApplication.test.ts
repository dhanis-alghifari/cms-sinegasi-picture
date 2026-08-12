import assert from 'node:assert/strict';
import test from 'node:test';
import { createApplication } from './createApplication.js';

test('createApplication composes every feature route without starting workers', async () => {
  const runtime = await createApplication();
  try {
    await runtime.app.ready();
    assert.equal(runtime.app.hasRoute({ method: 'GET', url: '/api/health' }), true);
    assert.equal(runtime.app.hasRoute({ method: 'POST', url: '/api/auth/login' }), true);
    assert.equal(runtime.app.hasRoute({ method: 'GET', url: '/api/cash/summary' }), true);
    assert.equal(runtime.app.hasRoute({ method: 'GET', url: '/api/borrowing' }), true);
    const health = await runtime.app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.headers['x-content-type-options'], 'nosniff');
    assert.equal(health.headers['x-frame-options'], 'DENY');
    assert.equal(health.headers['content-security-policy'], "frame-ancestors 'none'");
    assert.equal(health.headers['permissions-policy'], 'camera=(), geolocation=(), microphone=(), payment=()');
  } finally {
    await runtime.app.close();
  }
});
