import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';
import { getLoginRateLimitKeys } from '../modules/auth/loginRateLimiter.js';
import { createProxyTrust, parseProxyTrust, type ProxyTrustConfig } from './proxyTrust.js';

test('proxy trust defaults off; a count alone, unrestricted trust and broad peers fail closed', () => {
  for (const value of [undefined, '', '0', 'false']) {
    assert.deepEqual(parseProxyTrust(value, undefined), { trustProxy: false, trustedProxyAddresses: [] });
    assert.equal(createProxyTrust(parseProxyTrust(value, 'none')), false);
  }
  for (const [hops, peers] of [
    ['1', undefined], ['2', ''], ['1', 'none'], ['0', '192.0.2.1'], ['true', undefined], ['yes', '192.0.2.1'],
    ['5', '192.0.2.1'], ['01', '192.0.2.1'], ['1', '*'], ['1', 'loopback'], ['1', 'localhost'],
    ['1', '192.0.2.0/24'], ['1', '0.0.0.0'], ['1', '::'], ['1', '255.255.255.255'],
    ['1', '999.0.0.1'], ['1', '192.000.2.1'], ['1', '[::1]'], ['1', 'fe80::1%eth0'],
    ['1', '192.0.2.1,'], ['1', ',192.0.2.1'], ['1', '192.0.2.1, 192.0.2.2'],
    ['1', '192.0.2.1,192.0.2.1'], ['1', '192.0.2.1,::ffff:c000:201'],
    ['1', Array.from({ length: 9 }, (_, i) => `192.0.2.${i + 1}`).join(',')], ['1', 'a'.repeat(257)],
  ]) assert.throws(() => parseProxyTrust(hops, peers), /INVALID_PROXY_TRUST_CONFIGURATION/);
});

test('exact IPs and mapped IPv6 are canonicalized, immutable and bounded by hop', () => {
  const config = parseProxyTrust('2', '192.0.2.1,2001:0DB8:0:0:0:0:0:1');
  assert.deepEqual(config.trustedProxyAddresses, ['192.0.2.1', '2001:db8::1']);
  assert.ok(Object.isFrozen(config.trustedProxyAddresses));
  const trust = createProxyTrust(config);
  assert.equal(typeof trust, 'function');
  if (trust === false) throw new Error('EXPECTED_TRUST_FUNCTION');
  for (const address of ['192.0.2.1', '::ffff:192.0.2.1', '::ffff:c000:201', '2001:db8::1', '2001:0db8::1']) {
    assert.equal(trust(address, 0), true);
    assert.equal(trust(address, 1), true);
    assert.equal(trust(address, 2), false);
  }
  for (const address of ['192.0.2.2', '127.0.0.1', '172.18.0.3', '::ffff:192.0.2.2', 'localhost', 'invalid', 'fe80::1%eth0']) {
    assert.equal(trust(address, 0), false);
  }
  for (const hop of [-1, 0.5, 4, NaN, Infinity]) assert.equal(trust('192.0.2.1', hop), false);
  assert.throws(() => createProxyTrust({ trustProxy: 1, trustedProxyAddresses: [] }));
});

interface RequestMetadata { ip: string; hostname: string; protocol: string }
async function observe(config: ProxyTrustConfig, remoteAddress: string, forwardedFor: string): Promise<RequestMetadata> {
  const app = Fastify({ logger: false, trustProxy: createProxyTrust(config) });
  app.get('/', async request => ({ ip: request.ip, hostname: request.hostname, protocol: request.protocol }));
  try {
    const response = await app.inject({ method: 'GET', url: '/', remoteAddress, headers: {
      host: 'api.sinegasi.pictures', 'x-forwarded-for': forwardedFor,
      'x-forwarded-host': 'forwarded.invalid', 'x-forwarded-proto': 'https', 'cf-connecting-ip': '203.0.113.99',
    } });
    assert.equal(response.statusCode, 200);
    return response.json<RequestMetadata>();
  } finally { await app.close(); }
}

test('real Fastify ignores forged IP/host/proto/Cloudflare headers from direct or DEV peers', async () => {
  const policy = parseProxyTrust('1', '192.0.2.1');
  for (const peer of ['198.51.100.23', '172.18.0.2', '172.18.0.3', '127.0.0.1', '::ffff:198.51.100.23']) {
    const actual = await observe(policy, peer, '203.0.113.9, 203.0.113.10');
    assert.deepEqual(actual, { ip: peer, hostname: 'api.sinegasi.pictures', protocol: 'http' });
    const changedHeader = await observe(policy, peer, '203.0.113.11');
    assert.deepEqual(getLoginRateLimitKeys(actual.ip, 'fixture'), getLoginRateLimitKeys(changedHeader.ip, 'fixture'));
  }
});

test('approved immediate peer trusts only the nearest untrusted visitor, not a prepended spoof', async () => {
  const policy = parseProxyTrust('1', '192.0.2.1');
  for (const peer of ['192.0.2.1', '::ffff:192.0.2.1']) {
    const actual = await observe(policy, peer, '203.0.113.9, 198.51.100.23');
    assert.deepEqual(actual, { ip: '198.51.100.23', hostname: 'forwarded.invalid', protocol: 'https' });
  }
  const first = await observe(policy, '192.0.2.1', '203.0.113.9, 198.51.100.23');
  const second = await observe(policy, '192.0.2.1', '203.0.113.9, 198.51.100.24');
  const firstKeys = getLoginRateLimitKeys(first.ip, 'fixture'), secondKeys = getLoginRateLimitKeys(second.ip, 'fixture');
  assert.equal(firstKeys[0], secondKeys[0]);
  assert.notEqual(firstKeys[1], secondKeys[1]);
});

test('unknown intermediate hop stops the chain even if trusted addresses appear farther left', async () => {
  const policy = parseProxyTrust('2', '192.0.2.1,192.0.2.2');
  assert.equal((await observe(policy, '192.0.2.1', '203.0.113.9, 192.0.2.2')).ip, '203.0.113.9');
  assert.equal((await observe(policy, '192.0.2.1', '203.0.113.9, 192.0.2.2, 198.51.100.23')).ip, '198.51.100.23');
  assert.equal((await observe(parseProxyTrust('1', '192.0.2.1,192.0.2.2'), '192.0.2.1', '203.0.113.9, 192.0.2.2')).ip, '192.0.2.2');
});

test('disabled trust ignores all forwarded metadata even from an otherwise approved proxy', async () => {
  assert.deepEqual(await observe(parseProxyTrust('0', 'none'), '192.0.2.1', '203.0.113.9'),
    { ip: '192.0.2.1', hostname: 'api.sinegasi.pictures', protocol: 'http' });
});

test('actual runtime config requires explicit exact peers, with dotenv disabled and synthetic credentials only', () => {
  const script = 'const {runtimeConfig:c}=await import("./src/config/env.ts");console.log(JSON.stringify({trustProxy:c.trustProxy,trustedProxyAddresses:c.trustedProxyAddresses}));';
  const options = { cwd: resolve(__dirname, '../..'), encoding: 'utf8' as const, timeout: 10_000,
    env: { PATH: '/usr/bin:/bin', ENV_FILE_LOADING: 'disabled', NODE_ENV: 'production',
      CORS_ORIGINS: 'https://frontend.invalid', SUPABASE_URL: 'https://offline.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-only', JWT_SECRET: 'x'.repeat(64) } };
  for (const [hops, peers, expected] of [
    ['0', 'none', { trustProxy: false, trustedProxyAddresses: [] }],
    ['1', '192.0.2.1', { trustProxy: 1, trustedProxyAddresses: ['192.0.2.1'] }],
  ] as const) {
    const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script],
      { ...options, env: { ...options.env, TRUST_PROXY: hops, TRUST_PROXY_ADDRESSES: peers } });
    assert.deepEqual(JSON.parse(output), expected);
  }
  for (const change of [{ TRUST_PROXY: '1' }, { TRUST_PROXY: 'true' }, { TRUST_PROXY: '1', TRUST_PROXY_ADDRESSES: '172.18.0.0/16' }]) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script],
      { ...options, env: { ...options.env, ...change } });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /INVALID_PROXY_TRUST_CONFIGURATION/);
  }
});
