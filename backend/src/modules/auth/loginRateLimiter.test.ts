import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoginRateLimiter } from './loginRateLimiter.js';

test('login limiter blocks after the configured number of failures and clears on success', () => {
  const limiter = createLoginRateLimiter(60_000, 2, 10);
  limiter.recordFailure('ip:user');
  limiter.recordFailure('ip:user');
  assert.equal(limiter.isLimited('ip:user'), true);
  limiter.clear('ip:user');
  assert.equal(limiter.isLimited('ip:user'), false);
});
