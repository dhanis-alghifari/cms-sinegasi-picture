import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mockDocker = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({args, peers: process.env.DEV_TRUST_PROXY_ADDRESSES}) + '\\n');
if (args[0] === 'inspect') {
  if (args.at(-1) !== 'caddy-proxy') process.exit(98);
  if (args[2].includes('IPAddress')) {
    const reads = fs.readFileSync(process.env.MOCK_LOG, 'utf8').trim().split('\\n').map(line => JSON.parse(line)).filter(call => call.args[0] === 'inspect' && call.args[2].includes('IPAddress')).length;
    const driftAt = process.env.MOCK_PROXY_DRIFT_STAGE === 'build' ? 2 : process.env.MOCK_PROXY_DRIFT_STAGE === 'deploy' ? 3 : Infinity;
    console.log(reads >= driftAt ? '192.0.2.11' : process.env.MOCK_PEER ?? '192.0.2.10');
  }
  else console.log(process.env.MOCK_CADDY_RUNNING ?? 'true');
} else if (args[0] === 'compose') {
  if (!args.includes('--env-file') || args[args.indexOf('--env-file') + 1] !== '/dev/null') process.exit(97);
  if (!args[args.indexOf('-f') + 1].endsWith('/docker-compose.dev.yml')) process.exit(96);
  if (['up', 'build', 'run', 'ps'].some(command => args.includes(command)) && !args.includes('api-dev')) process.exit(95);
  if (args.includes('build') && process.env.MOCK_BUILD_FAILED === 'true') process.exit(1);
  if (args.includes('logs') || args.includes('down') || args.includes('stop') || args.includes('--remove-orphans')) process.exit(94);
} else process.exit(99);
`;

function fixture(t) {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sinegasi-dev-test-')));
  const bin = path.join(temporary, 'bin');
  const log = path.join(temporary, 'calls.jsonl');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(temporary, 'ops'));
  fs.copyFileSync(path.join(root, 'ops/deploy-dev.sh'), path.join(temporary, 'ops/deploy-dev.sh'));
  fs.copyFileSync(path.join(root, 'docker-compose.dev.yml'), path.join(temporary, 'docker-compose.dev.yml'));
  fs.writeFileSync(log, '');
  fs.writeFileSync(path.join(bin, 'docker'), mockDocker, { mode: 0o700 });
  for (const command of ['flock', 'sleep']) {
    fs.writeFileSync(path.join(bin, command), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  }
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\n[ "$MOCK_HEALTH_FAILED" != "true" ]\n', { mode: 0o700 });
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  return {
    run(overrides = {}, args = []) {
      return spawnSync('bash', [path.join(temporary, 'ops/deploy-dev.sh'), ...args], {
        encoding: 'utf8', timeout: 10_000,
        env: { PATH: `${bin}:${process.env.PATH}`, MOCK_LOG: log, DEPLOY_LOCK_FILE: path.join(temporary, 'deploy.lock'), ...overrides },
      });
    },
    calls() { return fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); },
  };
}

test('DEV pins the observed exact Caddy peer and never runs SQL by default', t => {
  const item = fixture(t);
  const result = item.run({ DEV_TRUST_PROXY_ADDRESSES: '0.0.0.0/0' });
  assert.equal(result.status, 0, result.stderr);
  const compose = item.calls().filter(call => call.args[0] === 'compose');
  assert.ok(compose.length > 0);
  assert.ok(compose.every(call => call.peers === '192.0.2.10'));
  assert.ok(!compose.some(call => call.args.includes('run')));
  assert.ok(compose.some(call => call.args.includes('up') && call.args.includes('--no-deps')));
  assert.ok(!item.calls().some(call => call.args.join(' ').includes('api-prod')));
});

test('missing, malformed or wildcard proxy metadata stops before any Compose operation', t => {
  for (const peer of ['', '0.0.0.0', '255.255.255.255', '999.0.0.1', '192.0.2.0/24', 'proxy.local', '192.0.2.10,192.0.2.11', '192.000.2.10']) {
    const item = fixture(t);
    assert.notEqual(item.run({ MOCK_PEER: peer }).status, 0);
    assert.ok(!item.calls().some(call => call.args[0] === 'compose'));
  }
});

test('stopped Caddy and failed builds cannot recreate the API', t => {
  for (const overrides of [{ MOCK_CADDY_RUNNING: 'false' }, { MOCK_BUILD_FAILED: 'true' }]) {
    const item = fixture(t);
    assert.notEqual(item.run(overrides).status, 0);
    assert.ok(!item.calls().some(call => call.args.includes('up')));
  }
});

test('schema writes require explicit opt-in; invalid mode and unsafe targets fail before Docker', t => {
  const approved = fixture(t);
  assert.equal(approved.run({ DEV_APPLY_MIGRATIONS: 'true' }).status, 0);
  const migrations = approved.calls().filter(call => call.args.includes('run'));
  assert.equal(migrations.length, 1);
  assert.equal(migrations[0].args.at(-1), 'dist/scripts/applyMigrations.js');
  for (const overrides of [{ DEV_APPLY_MIGRATIONS: 'yes' }, { API_SERVICE: 'api-prod' }, { COMPOSE_FILE: '/tmp/docker-compose.prod.yml' }]) {
    const item = fixture(t);
    assert.notEqual(item.run(overrides).status, 0);
    assert.equal(item.calls().length, 0);
  }
});

test('changed proxy topology is never declared healthy and build-time drift stops before recreation', t => {
  for (const stage of ['build', 'deploy']) {
    const item = fixture(t);
    const result = item.run({ MOCK_PROXY_DRIFT_STAGE: stage });
    assert.notEqual(result.status, 0);
    assert.ok(!result.stdout.includes('API healthy.'));
    if (stage === 'build') assert.ok(!item.calls().some(call => call.args.includes('up')));
  }
});

test('failed health checks do not dump private application logs or run recovery SQL', t => {
  const item = fixture(t);
  const result = item.run({ MOCK_HEALTH_FAILED: 'true' });
  assert.notEqual(result.status, 0);
  assert.ok(!item.calls().some(call => call.args.includes('logs') || call.args.includes('run')));
});
