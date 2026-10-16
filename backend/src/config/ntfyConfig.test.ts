import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

function inspectConfiguration(environment: 'development' | 'production', overrides: Record<string, string> = {}): Record<string, unknown> {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', `
    const { runtimeConfig: config } = require('./src/config/env.ts');
    process.stdout.write(JSON.stringify({
      enabled: config.ntfyEnabled, publicGenericEnabled: config.ntfyPublicGenericEnabled,
      topic: config.ntfyTopic, frontendConfigured: Boolean(config.ntfyFrontendUrl),
      backgroundJobsEnabled: config.backgroundJobsEnabled
    }));
  `], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      PATH: process.env.PATH, ENV_FILE_LOADING: 'disabled', NODE_ENV: environment,
      PUBLIC_DEPLOYMENT: 'false', ALLOW_DEV_AUTH: 'false', BACKGROUND_JOBS_ENABLED: 'false',
      JWT_SECRET: 'synthetic-configuration-test-only-'.repeat(2),
      SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-only',
      CORS_ORIGINS: environment === 'production' ? 'https://sinegasi.pictures' : 'http://localhost:5173',
      ...overrides,
    },
    encoding: 'utf8', timeout: 10000, maxBuffer: 8192,
  });
  assert.equal(result.status, 0, 'Isolated configuration fixture failed');
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

test('production push defaults to disabled with no DEV topic or frontend fallback', () => {
  assert.deepEqual(inspectConfiguration('production'), {
    enabled: false, publicGenericEnabled: false, topic: '', frontendConfigured: false, backgroundJobsEnabled: false,
  });
});

test('development push defaults remain separate and public generic mode is opt-in', () => {
  assert.deepEqual(inspectConfiguration('development'), {
    enabled: false, publicGenericEnabled: false, topic: 'sinegasi-dev-notif', frontendConfigured: true, backgroundJobsEnabled: false,
  });
  const explicit = inspectConfiguration('production', { NTFY_ENABLED: 'true', NTFY_PUBLIC_GENERIC_ENABLED: 'true', NTFY_TOPIC: 'sinegasi-notif' });
  assert.equal(explicit.enabled, true);
  assert.equal(explicit.publicGenericEnabled, true);
  assert.equal(explicit.topic, 'sinegasi-notif');
  assert.equal(inspectConfiguration('production', { NTFY_PUBLIC_GENERIC_ENABLED: 'invalid' }).publicGenericEnabled, false);
});
