import assert from 'node:assert/strict';
import test from 'node:test';
import { apiCredentials } from '../src/shared/api/requestCredentials';

test('only the HTTPS development API sends the Access cookie cross-origin', () => {
  assert.equal(apiCredentials('https://api-dev.sinegasi.pictures'), 'include');
  assert.equal(apiCredentials('https://api-dev.sinegasi.pictures/api'), 'include');
  assert.equal(apiCredentials('http://api-dev.sinegasi.pictures'), 'same-origin');
  assert.equal(apiCredentials('https://api-dev.sinegasi.pictures:8443'), 'same-origin');
  assert.equal(apiCredentials('https://api-dev.sinegasi.pictures.evil.invalid'), 'same-origin');
  assert.equal(apiCredentials('https://api.sinegasi.pictures'), 'same-origin');
  assert.equal(apiCredentials('/api'), 'same-origin');
});
