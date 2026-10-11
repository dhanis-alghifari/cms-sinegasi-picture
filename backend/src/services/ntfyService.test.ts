import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeConfig } from '../config/env.js';
import { notifyNewBorrowingSubmission, sendNtfyMessage, setCustomHttpSenderForTest } from './ntfyService.js';

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
  let capturedUrl = '';
  let capturedPayload: Record<string, unknown> = {};

  setCustomHttpSenderForTest(async (urlStr, bodyObj) => {
    capturedUrl = urlStr;
    capturedPayload = bodyObj as Record<string, unknown>;
    return { ok: true, status: 200, text: '{"id":"mocked"}' };
  });

  const originalConfig = {
    publicDeployment: runtimeConfig.publicDeployment,
    ntfyEnabled: runtimeConfig.ntfyEnabled,
    ntfyTopic: runtimeConfig.ntfyTopic,
    ntfyServerUrl: runtimeConfig.ntfyServerUrl,
    ntfyFrontendUrl: runtimeConfig.ntfyFrontendUrl,
    ntfyAccessToken: runtimeConfig.ntfyAccessToken,
  };

  Object.assign(runtimeConfig, {
    publicDeployment: true,
    ntfyEnabled: true,
    ntfyTopic: 'test-topic',
    ntfyServerUrl: 'https://ntfy.sh',
    ntfyFrontendUrl: 'https://sinegasi-picture-develop-cms.pages.dev',
    ntfyAccessToken: 'dummy-test-token',
  });

  try {
    const success = await notifyNewBorrowingSubmission({
      studentName: 'Ahmad Zaki',
      equipmentSummary: 'Sony A7 IV',
      keperluan: 'Shooting Film Pendek',
    });

    assert.equal(success, true);
    assert.equal(capturedUrl, 'https://ntfy.sh');
    assert.equal(capturedPayload.topic, 'test-topic');
    assert.equal(capturedPayload.title, '📋 Pengajuan Peminjaman Alat Baru');
    assert.equal(capturedPayload.priority, 4);
    assert.equal(capturedPayload.click, 'https://sinegasi-picture-develop-cms.pages.dev/notifications');
    const actions = capturedPayload.actions as Array<{ url: string; label: string }>;
    assert.equal(actions[0].url, 'https://sinegasi-picture-develop-cms.pages.dev/notifications');
    assert.equal(actions[0].label, 'Buka Notifikasi CMS');
    assert.match(String(capturedPayload.message), /Login ke CMS/);
    assert.doesNotMatch(String(capturedPayload.message), /Ahmad Zaki|Sony A7 IV|Shooting Film Pendek/);
  } finally {
    setCustomHttpSenderForTest(null);
    Object.assign(runtimeConfig, originalConfig);
  }
});

test('public deployments do not publish through anonymous push credentials', async () => {
  const original = { publicDeployment: runtimeConfig.publicDeployment, ntfyEnabled: runtimeConfig.ntfyEnabled, ntfyAccessToken: runtimeConfig.ntfyAccessToken };
  let sent = false;
  setCustomHttpSenderForTest(async () => { sent = true; return { ok: true, status: 200, text: '' }; });
  Object.assign(runtimeConfig, { publicDeployment: true, ntfyEnabled: true, ntfyAccessToken: '' });
  try {
    assert.equal(await sendNtfyMessage({ title: 'Test', message: 'Test' }), false);
    assert.equal(sent, false);
  } finally {
    setCustomHttpSenderForTest(null);
    Object.assign(runtimeConfig, original);
  }
});
