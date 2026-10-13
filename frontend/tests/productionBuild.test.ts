import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { build } from 'vite';
import { validateProductionBuild } from '../config/productionBuild.ts';

const good = { VITE_API_URL: 'https://api.sinegasi.pictures', VITE_R2_PUBLIC_DOMAIN: 'https://media.sinegasi.pictures' };
test('launch build requires explicit exact API and non-development media origins', () => {
  validateProductionBuild(good);
  validateProductionBuild({ ...good, VITE_API_URL: good.VITE_API_URL + '/api' });
  for (const change of [{ VITE_API_URL: undefined }, { VITE_API_URL: 'http://localhost:5001' },
    { VITE_API_URL: 'https://api.sinegasi.pictures.evil.invalid' }, { VITE_API_URL: good.VITE_API_URL + '/admin' },
    { VITE_API_URL: good.VITE_API_URL + '?secret=no' }, { VITE_API_BASE_URL: 'https://dev.example.com' },
    { VITE_R2_PUBLIC_DOMAIN: undefined }, { VITE_R2_PUBLIC_DOMAIN: 'https://pub-bacbd163ce50498d82672aab73389f38.r2.dev' },
    { VITE_R2_PUBLIC_DOMAIN: 'https://localhost' }, { VITE_R2_PUBLIC_DOMAIN: 'https://127.0.0.1' },
    { VITE_R2_PUBLIC_DOMAIN: 'https://user:secret@media.sinegasi.pictures' }, { VITE_R2_PUBLIC_DOMAIN: 'https://media.sinegasi.pictures/folder' }]) {
    assert.throws(() => validateProductionBuild({ ...good, ...change }));
  }
});

test('real Vite launch configuration fails closed without frontend API variables', async () => {
  const previous = process.env.VITE_API_URL;
  delete process.env.VITE_API_URL;
  try {
    await assert.rejects(build({ root: resolve(import.meta.dirname, '..'), configFile: resolve(import.meta.dirname, '../vite.config.ts'),
      mode: 'production-launch', envFile: false, logLevel: 'silent', build: { write: false } }), /PRODUCTION_EXPLICIT_HTTPS_CONFIGURATION_REQUIRED/);
  } finally {
    if (previous === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = previous;
  }
});

test('real launch build embeds the explicit production API/media without changing DEV configuration', async () => {
  const keys = ['VITE_API_URL', 'VITE_API_BASE_URL', 'VITE_R2_PUBLIC_DOMAIN'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, good); delete process.env.VITE_API_BASE_URL;
  try {
    const result = await build({ root: resolve(import.meta.dirname, '..'), configFile: resolve(import.meta.dirname, '../vite.config.ts'),
      mode: 'production-launch', envFile: false, logLevel: 'silent', build: { write: false } });
    assert.ok('output' in result);
    const chunks = result.output.filter(asset => asset.type === 'chunk');
    assert.ok(chunks.some(chunk => chunk.code.includes(good.VITE_API_URL)));
    assert.ok(chunks.some(chunk => chunk.code.includes(good.VITE_R2_PUBLIC_DOMAIN)));
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
