import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { ApiError } from '../src/shared/api/errors';
import { decodeWithSchema } from '../src/shared/api/responseValidation';

const decode = decodeWithSchema(z.array(z.number()));

test('normal response is decoded and malformed data still fails validation', () => {
  assert.deepEqual(decode([1, 2, 3]), [1, 2, 3]);
  assert.throws(() => decode(['invalid']), (error: unknown) =>
    error instanceof ApiError && error.errorCode === 'API_RESPONSE_INVALID');
});

test('oversized array is rejected before Zod collects validation errors', () => {
  assert.throws(() => decode(Array(10_001).fill('invalid')), (error: unknown) =>
    error instanceof ApiError && error.errorCode === 'API_RESPONSE_TOO_LARGE');
  assert.equal(decode(Array(10_000).fill(1)).length, 10_000);
});

test('nested collections cannot exceed the total node budget', () => {
  const decodeNested = decodeWithSchema(z.array(z.array(z.number())));
  const payload = Array.from({ length: 11 }, () => Array(10_000).fill(1));
  assert.throws(() => decodeNested(payload), (error: unknown) =>
    error instanceof ApiError && error.errorCode === 'API_RESPONSE_TOO_LARGE');
});
