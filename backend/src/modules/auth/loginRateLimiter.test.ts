import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createLoginRateLimiter,
  createSupabaseLoginRateLimiter,
  getLoginRateLimitKeys,
  LoginRateLimitUnavailableError,
  type LoginRateLimiter,
} from './loginRateLimiter.js';

interface RpcCall {
  name: string;
  parameters: Record<string, unknown>;
  signal?: AbortSignal;
}

function createRpcFixture(result: { data: unknown; error: unknown }): { client: SupabaseClient; calls: RpcCall[] } {
  const calls: RpcCall[] = [];
  const client = {
    rpc(name: string, parameters: Record<string, unknown>) {
      const call: RpcCall = { name, parameters };
      calls.push(call);
      return {
        abortSignal(signal: AbortSignal) {
          call.signal = signal;
          return Promise.resolve(result);
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test('login limiter blocks after the configured number of failures and clears on success', () => {
  const limiter = createLoginRateLimiter(60_000, 2, 10);
  limiter.recordFailure('ip:user');
  limiter.recordFailure('ip:user');
  assert.equal(limiter.isLimited('ip:user'), true);
  limiter.clear('ip:user');
  assert.equal(limiter.isLimited('ip:user'), false);
});

test('account key is canonical and independent of IP, while the IP key remains separate', () => {
  const first = getLoginRateLimitKeys('192.0.2.10', ' FixtureUser ');
  const second = getLoginRateLimitKeys('192.0.2.11', 'fixtureuser');
  assert.equal(first[0], second[0]);
  assert.notEqual(first[1], second[1]);
  assert.notEqual(first[0], first[1]);
  assert.throws(() => getLoginRateLimitKeys('192.0.2.10', 'x'.repeat(65)), LoginRateLimitUnavailableError);
  assert.throws(() => getLoginRateLimitKeys('192.0.2.10', '  '), LoginRateLimitUnavailableError);
  assert.throws(() => getLoginRateLimitKeys('x'.repeat(129), 'fixture'), LoginRateLimitUnavailableError);
});

test('key churn never evicts active failure counters; expired counters release capacity', () => {
  let timestamp = 10_000;
  const limiter = createLoginRateLimiter(60_000, 2, 2, () => timestamp);
  limiter.recordFailure('locked-account');
  limiter.recordFailure('locked-account');
  limiter.recordFailure('other-account');
  for (let index = 0; index < 10; index += 1) {
    assert.throws(() => limiter.recordFailure(`churn-${index}`), LoginRateLimitUnavailableError);
    assert.throws(() => limiter.isLimited(`churn-${index}`), LoginRateLimitUnavailableError);
  }
  assert.equal(limiter.isLimited('locked-account'), true);
  timestamp += 60_000;
  assert.equal(limiter.isLimited('new-account'), false);
  limiter.recordFailure('new-account');
  assert.equal(limiter.isLimited('locked-account'), false);
});

test('memory limiter bounds input keys and validates capacity settings', () => {
  const limiter = createLoginRateLimiter();
  assert.throws(() => limiter.isLimited('x'.repeat(1_025)), LoginRateLimitUnavailableError);
  assert.throws(() => createLoginRateLimiter(60_000, 2, 0), /Invalid login limiter configuration/);
  assert.throws(() => createLoginRateLimiter(0, 2, 10), /Invalid login limiter configuration/);
});

test('Supabase limiter stores hashed keys and applies an abort signal to every RPC', async () => {
  const key = getLoginRateLimitKeys('192.0.2.10', 'fixtureuser')[0];
  const check = createRpcFixture({ data: false, error: null });
  const writes = createRpcFixture({ data: null, error: null });
  const checkLimiter = createSupabaseLoginRateLimiter(check.client, undefined, 300, 10, { persistentRequired: true });
  const writeLimiter = createSupabaseLoginRateLimiter(writes.client, undefined, 300, 10, { persistentRequired: true });
  assert.equal(await checkLimiter.isLimited(key), false);
  await writeLimiter.recordFailure(key);
  await writeLimiter.clear(key);
  const calls = [...check.calls, ...writes.calls];
  assert.deepEqual(calls.map((call) => call.name), [
    'is_login_rate_limited', 'record_login_failure', 'clear_login_rate_limit',
  ]);
  const expectedHash = crypto.createHash('sha256').update(key).digest('hex');
  for (const call of calls) {
    assert.equal(call.parameters.p_rate_key, expectedHash);
    assert.ok(call.signal instanceof AbortSignal);
    assert.equal(call.signal.aborted, false);
    assert.equal(JSON.stringify(call.parameters).includes('fixtureuser'), false);
    assert.equal(JSON.stringify(call.parameters).includes('192.0.2.10'), false);
  }
});

test('shared limiter accepts only boolean decisions, never truthiness or array coercion', async () => {
  for (const data of [null, undefined, 0, 1, '', 'false', 'true', [], [false], { limited: false }]) {
    const { client } = createRpcFixture({ data, error: null });
    const limiter = createSupabaseLoginRateLimiter(client, undefined, 300, 10, { persistentRequired: true });
    await assert.rejects(limiter.isLimited('fixture-key'), LoginRateLimitUnavailableError);
  }
  const { client } = createRpcFixture({ data: true, error: null });
  assert.equal(await createSupabaseLoginRateLimiter(client).isLimited('fixture-key'), true);
});

test('public limiter fails closed on store errors without leaking provider details or using fallback', async () => {
  const { client } = createRpcFixture({ data: null, error: { message: 'private-fixture-provider-detail' } });
  let fallbackCalls = 0;
  const fallback: LoginRateLimiter = {
    isLimited() { fallbackCalls += 1; return false; },
    recordFailure() { fallbackCalls += 1; },
    clear() { fallbackCalls += 1; },
  };
  const limiter = createSupabaseLoginRateLimiter(client, fallback, 300, 10, { persistentRequired: true });
  for (const operation of [() => limiter.isLimited('fixture'), () => limiter.recordFailure('fixture'), () => limiter.clear('fixture')]) {
    await assert.rejects(async () => operation(), (error: unknown) => {
      assert.ok(error instanceof LoginRateLimitUnavailableError);
      assert.equal(error.message.includes('private-fixture'), false);
      return true;
    });
  }
  assert.equal(fallbackCalls, 0);
  const missingStore = createSupabaseLoginRateLimiter(null, fallback, 300, 10, { persistentRequired: true });
  assert.throws(() => missingStore.isLimited('fixture'), LoginRateLimitUnavailableError);
  assert.throws(() => missingStore.recordFailure('fixture'), LoginRateLimitUnavailableError);
  assert.throws(() => missingStore.clear('fixture'), LoginRateLimitUnavailableError);
  assert.equal(fallbackCalls, 0);
});

test('public limiter fails closed on thrown transport errors', async () => {
  const client = {
    rpc() { throw new Error('private-fixture-transport-detail'); },
  } as unknown as SupabaseClient;
  const limiter = createSupabaseLoginRateLimiter(client, undefined, 300, 10, { persistentRequired: true });
  await assert.rejects(limiter.isLimited('fixture'), LoginRateLimitUnavailableError);
  await assert.rejects(limiter.recordFailure('fixture'), LoginRateLimitUnavailableError);
  await assert.rejects(limiter.clear('fixture'), LoginRateLimitUnavailableError);
});

test('isolated development fallback still records, blocks, and clears on shared-store outage', async () => {
  const { client } = createRpcFixture({ data: null, error: { message: 'fixture-offline' } });
  const limiter = createSupabaseLoginRateLimiter(client, createLoginRateLimiter(60_000, 2, 10));
  assert.equal(await limiter.isLimited('fixture'), false);
  await limiter.recordFailure('fixture');
  await limiter.recordFailure('fixture');
  assert.equal(await limiter.isLimited('fixture'), true);
  await limiter.clear('fixture');
  assert.equal(await limiter.isLimited('fixture'), false);
});
