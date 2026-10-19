import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { build } from 'vite';
import { installGlobalClientErrorMonitoring, reportClientError } from '../src/shared/monitoring/reportClientError';
import {
  createClientErrorReporter,
  installClientErrorListeners,
  responseRequestId,
  type ClientErrorEvent,
} from '../src/shared/monitoring/clientErrors';

const tick = () => new Promise<void>((done) => setImmediate(done));

test('monitoring imports and stays inert outside the Vite browser runtime', () => {
  assert.doesNotThrow(() => reportClientError({ kind: 'render', code: 'RENDER_ERROR' }));
  assert.doesNotThrow(() => installGlobalClientErrorMonitoring()());
});

test('telemetry sends only closed metadata to the production first-party collector', async () => {
  const calls: Array<{ input: RequestInfo | URL; options?: RequestInit }> = [];
  const report = createClientErrorReporter({
    enabled: true,
    release: 'build-123abc',
    readToken: () => 'offline-dummy-token',
    fetch: async (input, options) => {
      calls.push({ input, options });
      return new Response(null, { status: 204 });
    },
  });
  const event = {
    kind: 'api', code: 'API_ERROR', requestId: 'req-123', statusCode: 503,
    message: 'PRIVATE_MESSAGE', stack: 'PRIVATE_STACK', url: 'https://app.invalid/?password=PRIVATE',
    username: 'PRIVATE_USERNAME', token: 'PRIVATE_TOKEN',
  } as const;
  report(event);
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, 'https://api.sinegasi.pictures/api/monitoring/client-errors');
  const options = calls[0].options!;
  assert.deepEqual(JSON.parse(String(options.body)), {
    kind: 'api', code: 'API_ERROR', release: 'build-123abc', requestId: 'req-123', statusCode: 503,
  });
  assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer offline-dummy-token');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
  assert.equal(String(options.body).includes('PRIVATE'), false);
});

test('disabled, logged-out, malformed, or unavailable local storage never sends telemetry', async () => {
  let requests = 0;
  const send: typeof fetch = async () => { requests += 1; return new Response(null, { status: 204 }); };
  createClientErrorReporter({ enabled: false, readToken: () => { assert.fail('disabled must not read token'); }, fetch: send })({ kind: 'render', code: 'RENDER_ERROR' });
  createClientErrorReporter({ enabled: true, readToken: () => null, fetch: send })({ kind: 'runtime', code: 'RUNTIME_ERROR' });
  const report = createClientErrorReporter({ enabled: true, readToken: () => { throw new Error('Storage blocked'); }, fetch: send });
  assert.doesNotThrow(() => report({ kind: 'runtime', code: 'RUNTIME_ERROR' }));
  const malformed = createClientErrorReporter({ enabled: true, readToken: () => 'offline-token', fetch: send });
  malformed({ kind: 'runtime', code: 'SECRET_EXCEPTION_TEXT' } as unknown as ClientErrorEvent);
  malformed(null as unknown as ClientErrorEvent);
  await tick();
  assert.equal(requests, 0);
});

test('invalid request IDs, releases, and statuses are omitted rather than copied into logs', async () => {
  let body = '';
  const report = createClientErrorReporter({
    enabled: true,
    release: 'https://private.invalid/?token=PRIVATE',
    readToken: () => 'offline-token',
    fetch: async (_input, options) => { body = String(options?.body); return new Response(null, { status: 204 }); },
  });
  report({ kind: 'api', code: 'API_ERROR', requestId: 'PRIVATE\nInjected', statusCode: 200 });
  await tick();
  assert.deepEqual(JSON.parse(body), { kind: 'api', code: 'API_ERROR' });
  assert.equal(responseRequestId(new Response(null, { headers: { 'X-Request-Id': 'req-header' } }), 'private?token=no'), 'req-header');
  assert.equal(responseRequestId(new Response(null, { headers: { 'X-Request-Id': 'private?token=no' } })), undefined);
  assert.equal(responseRequestId(new Response(null, { headers: { 'X-Request-Id': 'req-header' } }), 'req-body'), 'req-body');
});

test('one tab deduplicates and caps events at ten per minute without retrying failed delivery', async () => {
  let time = 100_000;
  let requests = 0;
  const report = createClientErrorReporter({
    enabled: true, readToken: () => 'offline-token', now: () => time,
    fetch: async () => { requests += 1; throw new Error('Offline'); },
  });
  const first = { kind: 'api', code: 'API_ERROR', requestId: 'req-0', statusCode: 500 } as const;
  report(first);
  report(first);
  for (let index = 1; index <= 30; index += 1) {
    report({ ...first, requestId: `req-${index}` });
  }
  await tick();
  assert.equal(requests, 10);
  time += 60_000;
  report(first);
  await tick();
  assert.equal(requests, 11);
});

test('collector 401/429/500 responses are not retried and timeout aborts the best-effort request', async (t) => {
  for (const status of [401, 429, 500]) {
    let requests = 0;
    const report = createClientErrorReporter({
      enabled: true, readToken: () => 'offline-token',
      fetch: async () => { requests += 1; return new Response(null, { status }); },
    });
    report({ kind: 'runtime', code: 'RUNTIME_ERROR' });
    await tick();
    assert.equal(requests, 1);
  }
  let signal: AbortSignal | null | undefined;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const report = createClientErrorReporter({
    enabled: true, readToken: () => 'offline-token',
    fetch: async (_input, options) => {
      signal = options?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('Timeout')), { once: true });
      });
    },
  });
  report({ kind: 'runtime', code: 'RUNTIME_ERROR' });
  assert.equal(signal?.aborted, false);
  t.mock.timers.tick(3_000);
  await tick();
  assert.equal(signal?.aborted, true);
});

test('global listeners do not inspect exception fields and cleanup removes both listeners', () => {
  const target = new EventTarget();
  const events: ClientErrorEvent[] = [];
  const remove = installClientErrorListeners(target, (event) => { events.push(event); });
  const runtime = new Event('error');
  const rejection = new Event('unhandledrejection');
  Object.defineProperty(runtime, 'error', { get: () => assert.fail('Must not inspect exception') });
  Object.defineProperty(rejection, 'reason', { get: () => assert.fail('Must not inspect rejection') });
  target.dispatchEvent(runtime);
  target.dispatchEvent(rejection);
  assert.deepEqual(events, [
    { kind: 'runtime', code: 'RUNTIME_ERROR' },
    { kind: 'unhandled_rejection', code: 'UNHANDLED_REJECTION' },
  ]);
  remove();
  target.dispatchEvent(runtime);
  target.dispatchEvent(rejection);
  assert.equal(events.length, 2);
});

test('built API client preserves request IDs, reports only server/network failures and never collector recursion', async (t) => {
  const result = await build({
    root: resolve(import.meta.dirname, '..'), configFile: false, envFile: false,
    envPrefix: 'MONITOR_TEST_ONLY_', logLevel: 'silent',
    resolve: { alias: { '@': resolve(import.meta.dirname, '../src') } },
    define: {
      'import.meta.env.PROD': 'true',
      'import.meta.env.DEV': 'false',
      'import.meta.env.VITE_API_URL': JSON.stringify('https://api.sinegasi.pictures'),
      'import.meta.env.VITE_API_BASE_URL': 'undefined',
      'import.meta.env.VITE_APP_NAME': 'undefined',
      'import.meta.env.VITE_APP_RELEASE': JSON.stringify('offline-test-build'),
    },
    build: { write: false, minify: false, lib: { entry: resolve(import.meta.dirname, '../src/shared/api/client.ts'), formats: ['es'] } },
  });
  const output = Array.isArray(result) ? result[0] : result;
  assert.ok('output' in output);
  const chunk = output.output.find((item) => item.type === 'chunk');
  assert.ok(chunk?.type === 'chunk');
  const collected: Record<string, unknown>[] = [];
  let applicationRequests = 0;
  let mode: 'server' | 'unauthorized' | 'network' | 'abort' | 'collector' = 'server';
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, options?: RequestInit) => {
    if (String(input).endsWith('/api/monitoring/client-errors') && mode !== 'collector') {
      collected.push(JSON.parse(String(options?.body)));
      return new Response(null, { status: 204 });
    }
    applicationRequests += 1;
    if (mode === 'network' || mode === 'abort') throw new TypeError('PRIVATE_NETWORK_DETAIL');
    return Response.json({ message: 'PRIVATE_SERVER_MESSAGE', error: 'PRIVATE_DOMAIN_ERROR' }, {
      status: mode === 'unauthorized' ? 401 : 503, headers: { 'X-Request-Id': 'req-header-fallback' },
    });
  });
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => 'offline-dummy-token' },
  });
  try {
    const { apiClient } = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
    await assert.rejects(() => apiClient.get('/api/example?private=PRIVATE_QUERY'), (error: unknown) => {
      assert.equal((error as { requestId?: string }).requestId, 'req-header-fallback');
      return true;
    });
    await tick();
    assert.deepEqual(collected[0], {
      kind: 'api', code: 'API_ERROR', release: 'offline-test-build', requestId: 'req-header-fallback', statusCode: 503,
    });
    mode = 'unauthorized';
    await assert.rejects(() => apiClient.get('/api/example'));
    await tick();
    assert.equal(collected.length, 1);
    mode = 'network';
    await assert.rejects(() => apiClient.get('/api/example'));
    await tick();
    assert.equal(collected.length, 2);
    assert.equal(collected[1].code, 'NETWORK_ERROR');
    mode = 'abort';
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => apiClient.get('/api/example', { signal: controller.signal }));
    await tick();
    assert.equal(collected.length, 2);
    mode = 'collector';
    await assert.rejects(() => apiClient.post('/api/monitoring/client-errors', {}));
    await tick();
    assert.equal(collected.length, 2);
    assert.equal(applicationRequests, 5);
    assert.equal(JSON.stringify(collected).includes('PRIVATE'), false);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
