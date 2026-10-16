import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import Fastify from 'fastify';
import { registerGracefulShutdown } from './gracefulShutdown.js';

class ProcessFixture extends EventEmitter {
  readonly exitCodes: number[] = [];

  exit(code: number): void {
    this.exitCodes.push(code);
    this.emit('exit', code);
  }
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  test(`${signal} waits for application close and ignores repeated shutdown signals`, async () => {
    const control = new ProcessFixture();
    const messages: unknown[] = [];
    let closes = 0;
    let complete!: () => void;
    const closed = new Promise<void>(resolve => { complete = resolve; });
    const dispose = registerGracefulShutdown({
      close: () => { closes += 1; return closed; },
      log: { error: (...args: unknown[]) => { messages.push(...args); } },
    }, control);
    try {
      control.emit(signal);
      control.emit('SIGTERM');
      control.emit('SIGINT');
      assert.equal(closes, 1);
      assert.deepEqual(control.exitCodes, []);
      complete();
      await setImmediate();
      assert.deepEqual(control.exitCodes, [0]);
      assert.deepEqual(messages, []);
      assert.equal(control.listenerCount('SIGTERM') + control.listenerCount('SIGINT'), 0);
    } finally { dispose(); }
  });
}

test('real Fastify drains an in-flight request and closes workers before process exit', async () => {
  const app = Fastify({ logger: false });
  const control = new ProcessFixture();
  let begin!: () => void;
  let complete!: () => void;
  let workersClosed = false;
  const started = new Promise<void>(resolve => { begin = resolve; });
  const pending = new Promise<void>(resolve => { complete = resolve; });
  app.get('/drain', async () => { begin(); await pending; return { drained: true }; });
  app.addHook('onClose', async () => { workersClosed = true; });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const dispose = registerGracefulShutdown(app, control);
  try {
    const response = fetch(`${address}/drain`);
    await started;
    const exited = once(control, 'exit');
    control.emit('SIGTERM');
    assert.deepEqual(control.exitCodes, []);
    assert.equal(workersClosed, false);
    complete();
    assert.deepEqual(await (await response).json(), { drained: true });
    await exited;
    assert.equal(workersClosed, true);
    assert.deepEqual(control.exitCodes, [0]);
  } finally {
    complete();
    dispose();
    await app.close();
  }
});

test('close failure exits nonzero without logging provider error details', async () => {
  const control = new ProcessFixture();
  const messages: unknown[] = [];
  const dispose = registerGracefulShutdown({
    close: async () => { throw new Error('synthetic-sensitive-provider-error'); },
    log: { error: (...args: unknown[]) => { messages.push(...args); } },
  }, control);
  try {
    control.emit('SIGTERM');
    await setImmediate();
    assert.deepEqual(control.exitCodes, [1]);
    assert.deepEqual(messages, ['Application shutdown failed']);
  } finally { dispose(); }
});

test('hung close has a bounded deadline and cannot later report success', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const control = new ProcessFixture();
  const messages: unknown[] = [];
  let complete!: () => void;
  const closed = new Promise<void>(resolve => { complete = resolve; });
  const dispose = registerGracefulShutdown({
    close: () => closed,
    log: { error: (...args: unknown[]) => { messages.push(...args); } },
  }, control);
  try {
    control.emit('SIGTERM');
    context.mock.timers.tick(24_999);
    assert.deepEqual(control.exitCodes, []);
    context.mock.timers.tick(1);
    assert.deepEqual(control.exitCodes, [1]);
    assert.deepEqual(messages, ['Application shutdown exceeded deadline']);
    complete();
    await setImmediate();
    assert.deepEqual(control.exitCodes, [1]);
  } finally { dispose(); }
});

test('disposal removes signal handlers without starting shutdown', () => {
  const control = new ProcessFixture();
  let closes = 0;
  const dispose = registerGracefulShutdown({
    close: async () => { closes += 1; },
    log: { error: () => {} },
  }, control);
  dispose();
  control.emit('SIGTERM');
  assert.equal(closes, 0);
  assert.deepEqual(control.exitCodes, []);
});
