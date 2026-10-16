import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeConfig, type RuntimeConfig } from '../config/env.js';
import {
  notifyCashDisputeSubmitted,
  notifyNewBorrowingSubmission,
  notifyReturnReportSubmitted,
  sendNtfyMessage,
  setCustomHttpSenderForTest,
  type HttpSender,
} from './ntfyService.js';

const approvedPublicConfig: Partial<RuntimeConfig> = {
  environment: 'production',
  publicDeployment: true,
  ntfyEnabled: true,
  ntfyPublicGenericEnabled: true,
  ntfyServerUrl: 'https://ntfy.sh',
  ntfyTopic: 'sinegasi-notif',
  ntfyCashReviewTopic: 'sinegasi-notif',
  ntfyFrontendUrl: 'https://sinegasi.pictures',
  ntfyAccessToken: '',
};

async function withMockedDelivery(
  overrides: Partial<RuntimeConfig>,
  sender: HttpSender,
  check: () => Promise<void>,
): Promise<void> {
  const original = { ...runtimeConfig };
  Object.assign(runtimeConfig, approvedPublicConfig, overrides);
  setCustomHttpSenderForTest(sender);
  try {
    await check();
  } finally {
    setCustomHttpSenderForTest(null);
    Object.assign(runtimeConfig, original);
  }
}

test('public topic emits only the three fixed generic workflows, with no PII or credentials', async () => {
  const requests: Array<{ payload: unknown; headers: Record<string, string> | undefined }> = [];
  await withMockedDelivery({}, async (url, payload, timeout, headers) => {
    assert.equal(url, 'https://ntfy.sh');
    assert.equal(timeout, 7000);
    requests.push({ payload, headers });
    return { ok: true, status: 200, text: '' };
  }, async () => {
    const privateInput = {
      studentName: 'PRIVATE_STUDENT_NAME',
      borrowingId: 'PRIVATE_BORROWING_ID',
      disputeId: 'PRIVATE_DISPUTE_ID',
      equipmentSummary: 'PRIVATE_EQUIPMENT',
      keperluan: 'PRIVATE_PURPOSE',
    };
    assert.equal(await notifyNewBorrowingSubmission(privateInput), true);
    assert.equal(await notifyReturnReportSubmitted(privateInput), true);
    assert.equal(await notifyCashDisputeSubmitted(privateInput), true);
    assert.equal(requests.length, 3);
    const links = ['/notifications', '/borrowing', '/cash?scope=manage'];
    for (const [index, request] of requests.entries()) {
      const payload = request.payload as Record<string, unknown>;
      assert.equal(request.headers, undefined);
      assert.deepEqual(Object.keys(payload).sort(), ['actions', 'click', 'message', 'priority', 'tags', 'title', 'topic']);
      assert.equal(payload.topic, 'sinegasi-notif');
      assert.equal(payload.priority, 4);
      assert.match(String(payload.message), /Login ke CMS/);
      assert.equal(payload.click, `https://sinegasi.pictures${links[index]}`);
      const actions = payload.actions as Array<{ action: string; url: string }>;
      assert.equal(actions.length, 1);
      assert.equal(actions[0].action, 'view');
      assert.equal(actions[0].url, payload.click);
      assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_|Authorization|Bearer|attachment|token/i);
    }
  });
});

test('public generic opt-in never authorizes free-form messages, topic overrides or arbitrary links', async () => {
  let calls = 0;
  await withMockedDelivery({}, async () => {
    calls += 1;
    return { ok: true, status: 200, text: '' };
  }, async () => {
    assert.equal(await sendNtfyMessage({
      topic: 'unapproved-topic', title: 'PRIVATE_TITLE', message: 'PRIVATE_DATA',
      clickUrl: 'https://unapproved.invalid', actionLabel: 'Unapproved', actionUrl: 'https://unapproved.invalid',
    }), false);
    assert.equal(await sendNtfyMessage({ title: 'Test', message: 'Hello' }), false);
    assert.equal(calls, 0);
  });
});

const unsafeConfigurations: Array<[string, Partial<RuntimeConfig>]> = [
  ['disabled', { ntfyEnabled: false }],
  ['missing opt-in', { ntfyPublicGenericEnabled: false }],
  ['not production', { environment: 'development' }],
  ['not public deployment', { publicDeployment: false }],
  ['HTTP', { ntfyServerUrl: 'http://ntfy.sh' }],
  ['other host', { ntfyServerUrl: 'https://ntfy.sh.unapproved.invalid' }],
  ['URL credentials', { ntfyServerUrl: 'https://fixture:fixture@ntfy.sh' }],
  ['URL path', { ntfyServerUrl: 'https://ntfy.sh/unapproved' }],
  ['URL query', { ntfyServerUrl: 'https://ntfy.sh?token=fixture' }],
  ['URL fragment', { ntfyServerUrl: 'https://ntfy.sh#fixture' }],
  ['nonstandard port', { ntfyServerUrl: 'https://ntfy.sh:444' }],
  ['missing topic', { ntfyTopic: '' }],
  ['DEV topic', { ntfyTopic: 'sinegasi-dev-notif' }],
  ['other cash topic', { ntfyCashReviewTopic: 'unapproved-cash-topic' }],
  ['missing frontend', { ntfyFrontendUrl: '' }],
  ['other frontend', { ntfyFrontendUrl: 'https://unapproved.invalid' }],
  ['frontend query', { ntfyFrontendUrl: 'https://sinegasi.pictures?token=fixture' }],
  ['token in anonymous mode', { ntfyAccessToken: 'PRIVATE_TOKEN' }],
];

for (const [label, overrides] of unsafeConfigurations) {
  test(`public topic refuses ${label} before any transport call`, async () => {
    let calls = 0;
    await withMockedDelivery(overrides, async () => {
      calls += 1;
      return { ok: true, status: 200, text: '' };
    }, async () => {
      assert.equal(await notifyNewBorrowingSubmission({ studentName: '', equipmentSummary: '' }), false);
      assert.equal(await notifyReturnReportSubmitted({}), false);
      assert.equal(await notifyCashDisputeSubmitted({}), false);
      assert.equal(calls, 0);
    });
  });
}

test('cash review falls back to the approved main topic, never a DEV topic', async () => {
  await withMockedDelivery({ ntfyCashReviewTopic: '' }, async (_url, payload) => {
    assert.equal((payload as Record<string, unknown>).topic, 'sinegasi-notif');
    return { ok: true, status: 200, text: '' };
  }, async () => {
    assert.equal(await notifyCashDisputeSubmitted({}), true);
  });
});

test('ntfy errors are best effort and never log provider text, tokens or exception details', async () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  try {
    await withMockedDelivery({}, async () => ({ ok: false, status: 429, text: 'PRIVATE_RESPONSE' }), async () => {
      assert.equal(await notifyCashDisputeSubmitted({}), false);
    });
    await withMockedDelivery({}, async () => { throw new Error('PRIVATE_ERROR'); }, async () => {
      assert.equal(await notifyReturnReportSubmitted({}), false);
    });
    assert.equal(warnings.length, 2);
    assert.doesNotMatch(warnings.join('\n'), /PRIVATE_/);
  } finally {
    console.warn = originalWarn;
  }
});
