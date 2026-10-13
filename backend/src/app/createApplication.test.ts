import assert from 'node:assert/strict';
import test from 'node:test';
import { createApplication } from './createApplication.js';
import { runtimeConfig } from '../config/env.js';

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

test('application composition uses address-aware trust rather than the old hop-only adapter', async () => {
  const previous = { trustProxy: runtimeConfig.trustProxy, trustedProxyAddresses: runtimeConfig.trustedProxyAddresses };
  runtimeConfig.trustProxy = 1;
  runtimeConfig.trustedProxyAddresses = ['192.0.2.1'];
  try {
    const runtime = await createApplication();
    let observed = '';
    runtime.app.addHook('onRequest', async request => { observed = request.ip; });
    try {
      for (const [remoteAddress, expected] of [['198.51.100.23', '198.51.100.23'], ['192.0.2.1', '203.0.113.9']]) {
        const response = await runtime.app.inject({ method: 'GET', url: '/api/health', remoteAddress,
          headers: { 'x-forwarded-for': '203.0.113.9' } });
        assert.equal(response.statusCode, 200);
        assert.equal(observed, expected);
      }
    } finally { await runtime.app.close(); }
  } finally { Object.assign(runtimeConfig, previous); }
});
