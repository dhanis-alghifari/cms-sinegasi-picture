import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeConfig } from '../config/env.js';
import { notifyNewBorrowingSubmission, sendNtfyMessage } from './ntfyService.js';

test('ntfy service respects ntfyEnabled flag when set to false', async () => {
  const originalEnabled = runtimeConfig.ntfyEnabled;
  runtimeConfig.ntfyEnabled = false;

  try {
    const result = await sendNtfyMessage({
      title: 'Test',
      message: 'Hello World',
    });
    assert.equal(result, false);
  } finally {
    runtimeConfig.ntfyEnabled = originalEnabled;
  }
});

test('notifyNewBorrowingSubmission formats JSON payload with direct link and actions', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody = '';

  // Mock fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    capturedBody = String(init?.body || '');
    return new Response('{"id":"mocked"}', { status: 200 });
  }) as typeof fetch;

  const originalConfig = {
    ntfyEnabled: runtimeConfig.ntfyEnabled,
    ntfyTopic: runtimeConfig.ntfyTopic,
    ntfyServerUrl: runtimeConfig.ntfyServerUrl,
    ntfyFrontendUrl: runtimeConfig.ntfyFrontendUrl,
  };

  Object.assign(runtimeConfig, {
    ntfyEnabled: true,
    ntfyTopic: 'test-topic',
    ntfyServerUrl: 'https://ntfy.sh',
    ntfyFrontendUrl: 'https://sinegasi-picture-develop-cms.pages.dev',
  });

  try {
    const success = await notifyNewBorrowingSubmission({
      studentName: 'Ahmad Zaki',
      equipmentSummary: 'Sony A7 IV',
      keperluan: 'Shooting Film Pendek',
    });

    assert.equal(success, true);
    assert.equal(capturedUrl, 'https://ntfy.sh');
    assert.equal(capturedHeaders['Content-Type'], 'application/json');

    const parsed = JSON.parse(capturedBody);
    assert.equal(parsed.topic, 'test-topic');
    assert.equal(parsed.title, '📋 Pengajuan Peminjaman Alat Baru');
    assert.equal(parsed.priority, 4);
    assert.equal(parsed.click, 'https://sinegasi-picture-develop-cms.pages.dev/notifications');
    assert.equal(parsed.actions[0].url, 'https://sinegasi-picture-develop-cms.pages.dev/notifications');
    assert.equal(parsed.actions[0].label, 'Buka Notifikasi CMS');
    assert.match(parsed.message, /Ahmad Zaki/);
    assert.match(parsed.message, /Sony A7 IV/);
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(runtimeConfig, originalConfig);
  }
});
