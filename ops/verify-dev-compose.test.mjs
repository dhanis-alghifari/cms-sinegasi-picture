import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createValidationInput } from './verify-dev-compose.mjs';

test('Compose CI adapter changes only the private env-file reference, not runtime configuration', () => {
  const source = readFileSync(new URL('../docker-compose.dev.yml', import.meta.url), 'utf8');
  const result = createValidationInput(source);
  assert.equal(result.replace('      - /dev/null', '      - ./backend/.env.development'), source);
  assert.match(result, /TRUST_PROXY=1/);
  assert.ok(result.includes('TRUST_PROXY_ADDRESSES=${DEV_TRUST_PROXY_ADDRESSES:?'));
});

test('missing or duplicate private references cannot silently weaken CI validation', () => {
  assert.throws(() => createValidationInput('services: {}'), /DEV_ENV_REFERENCE_CHANGED/);
  assert.throws(() => createValidationInput('      - ./backend/.env.development\n      - ./backend/.env.development'), /DEV_ENV_REFERENCE_CHANGED/);
});
