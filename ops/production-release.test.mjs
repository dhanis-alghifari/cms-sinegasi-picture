import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const newSha = 'a'.repeat(40);
const oldSha = 'b'.repeat(40);
const manifest = 'c'.repeat(64);
const newImage = `ghcr.io/example/sinegasi/api@sha256:${'d'.repeat(64)}`;
const oldImage = `ghcr.io/example/sinegasi/api@sha256:${'e'.repeat(64)}`;

const mockDocker = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(process.env.MOCK_STATE, 'utf8'));
const activeImage = process.env.API_IMAGE || '';
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({ args, image: activeImage }) + '\\n');
function save() { fs.writeFileSync(process.env.MOCK_STATE, JSON.stringify(state)); }
function output(value) { process.stdout.write(value + '\\n'); }
if (args[0] === 'pull') {
  if (process.env.MOCK_MODE === 'pull-failed' && args[1] === process.env.NEW_IMAGE) process.exit(1);
} else if (args[0] === 'image' && args[1] === 'inspect') {
  const image = args.at(-1);
  output(process.env.MOCK_MODE === 'wrong-revision' && image === process.env.NEW_IMAGE ? 'f'.repeat(40) : image === process.env.NEW_IMAGE ? process.env.NEW_SHA : process.env.OLD_SHA);
} else if (args[0] === 'inspect') {
  const name = args.at(-1);
  const format = args[2];
  if (name === 'caddy-proxy' || name === 'sinegasi-api-dev') {
    output(name + '|true');
  } else if (name === 'sinegasi-api-prod') {
    if (!state.current) process.exit(1);
    if (format.includes('Config.Image')) output(state.current);
    else output(state.current === process.env.NEW_IMAGE && ['unhealthy', 'rollback-failed'].includes(process.env.MOCK_MODE) ? 'unhealthy' : 'healthy');
  } else process.exit(99);
} else if (args[0] === 'compose') {
  if (!args.includes('sinegasi-prod')) process.exit(99);
  if (args.includes('config')) {
    if (!args.includes('--quiet')) process.exit(99);
  } else if (args.includes('run')) {
    if (!args.includes('--rm') || !args.includes('--no-deps') || args.at(-1) !== 'node') process.exit(99);
    if (process.env.MOCK_MODE === 'preflight-failed' && activeImage === process.env.NEW_IMAGE) process.exit(1);
  } else if (args.includes('up')) {
    if (args.at(-1) !== 'api-prod' || !args.includes('--no-build') || !args.includes('--no-deps') || !args.includes('--force-recreate')) process.exit(99);
    state.current = activeImage; save();
    if (process.env.MOCK_MODE === 'start-failed' && activeImage === process.env.NEW_IMAGE) process.exit(1);
    if (process.env.MOCK_MODE === 'rollback-failed' && activeImage === process.env.OLD_IMAGE) process.exit(1);
  } else if (args.includes('stop')) {
    if (args.at(-1) !== 'api-prod') process.exit(99);
    state.stopped = true; save();
  } else process.exit(99);
} else process.exit(99);
`;

function fixture(previous = true) {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sinegasi-release-test-')));
  const production = path.join(temporary, 'sinegasi-prod');
  const mockBin = path.join(temporary, 'bin');
  const log = path.join(temporary, 'commands.jsonl');
  const state = path.join(temporary, 'docker-state.json');
  const directories = [production, mockBin, path.join(production, 'config'), path.join(production, 'config/approvals'), path.join(production, 'state'), path.join(production, 'releases')];
  for (const directory of directories) fs.mkdirSync(directory, { mode: 0o700 });
  fs.writeFileSync(path.join(production, 'config/backend.env'), '', { mode: 0o600 });
  fs.writeFileSync(log, '', { mode: 0o600 });
  fs.writeFileSync(state, JSON.stringify({ current: previous ? oldImage : '' }), { mode: 0o600 });
  fs.writeFileSync(path.join(production, 'state/sinegasi-vps-deploy.lock'), 'lock-must-not-be-truncated', { mode: 0o600 });
  fs.writeFileSync(path.join(mockBin, 'docker'), mockDocker, { mode: 0o700 });
  for (const command of ['curl', 'flock', 'sleep']) {
    fs.writeFileSync(path.join(mockBin, command), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  }
  fs.writeFileSync(path.join(mockBin, 'timeout'), '#!/bin/sh\nshift\nexec "$@"\n', { mode: 0o700 });
  for (const [sha, image] of [[newSha, newImage], ...(previous ? [[oldSha, oldImage]] : [])]) {
    const release = path.join(production, 'releases', sha);
    fs.mkdirSync(release, { mode: 0o700 });
    fs.mkdirSync(path.join(release, 'ops'), { mode: 0o700 });
    fs.copyFileSync(path.join(root, 'docker-compose.prod.yml'), path.join(release, 'docker-compose.prod.yml'));
    fs.copyFileSync(path.join(root, 'ops/production-runtime-preflight.cjs'), path.join(release, 'ops/production-runtime-preflight.cjs'));
    fs.writeFileSync(path.join(production, 'config/approvals', `${sha}.txt`), [
      `release_sha=${sha}`, `api_image=${image}`, `migration_manifest_sha256=${manifest}`,
      'project_ref=pvbdiftvzoeelibxlxzb', 'trust_proxy_hops=1', 'database_rollback_compatible=true',
      'backup_reference=isolated-restored-backup', 'rehearsal_reference=isolated-rehearsal-proof', 'approved_by=test-operator', '',
    ].join('\n'), { mode: 0o600 });
  }
  if (previous) fs.writeFileSync(path.join(production, 'state/current-release.txt'), `release_sha=${oldSha}\napi_image=${oldImage}\nmigration_manifest_sha256=${manifest}\n`, { mode: 0o600 });
  return {
    production,
    run(mode = '', image = newImage) {
      return spawnSync('bash', ['-c', 'set -Eeuo pipefail; umask 077; source "$1"; deploy_production "$2" "$3" "$4" "$5" "$6"', 'production-release-test', path.join(root, 'ops/production-release.sh'), production, newSha, image, manifest, path.join(production, 'state/sinegasi-vps-deploy.lock')], {
        encoding: 'utf8', timeout: 15_000,
        env: { ...process.env, PATH: `${mockBin}:${process.env.PATH}`, MOCK_STATE: state, MOCK_LOG: log, MOCK_MODE: mode, NEW_IMAGE: newImage, OLD_IMAGE: oldImage, NEW_SHA: newSha, OLD_SHA: oldSha, DEPLOY_HEALTH_ATTEMPTS: '1' },
      });
    },
    state: () => JSON.parse(fs.readFileSync(state, 'utf8')),
    calls: () => fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)),
    dispose: () => fs.rmSync(temporary, { recursive: true, force: true }),
  };
}

test('successful release uses only pinned image and writes separate release metadata', () => {
  const item = fixture();
  try {
    const result = item.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(item.state().current, newImage);
    assert.match(fs.readFileSync(path.join(item.production, 'state/current-release.txt'), 'utf8'), new RegExp(newSha));
    assert.equal(item.calls().filter((call) => call.args.includes('up')).length, 1);
    assert.equal(fs.readFileSync(path.join(item.production, 'state/sinegasi-vps-deploy.lock'), 'utf8'), 'lock-must-not-be-truncated');
    for (const call of item.calls()) {
      assert.ok(!call.args.includes('build') && !call.args.includes('logs') && !call.args.includes('--remove-orphans'));
      assert.ok(!call.args.join(' ').includes('applyMigrations'));
    }
  } finally { item.dispose(); }
});

for (const mode of ['unhealthy', 'start-failed']) {
  test(`${mode} restores exact previous image/package without advancing metadata`, () => {
    const item = fixture();
    try {
      const result = item.run(mode);
      assert.notEqual(result.status, 0);
      assert.equal(item.state().current, oldImage);
      assert.match(result.stderr, /Previous approved release digest restored/);
      const updates = item.calls().filter((call) => call.args.includes('up'));
      assert.deepEqual(updates.map((call) => call.image), [newImage, oldImage]);
      assert.ok(updates[1].args.includes(path.join(item.production, 'releases', oldSha, 'docker-compose.prod.yml')));
      assert.match(fs.readFileSync(path.join(item.production, 'state/current-release.txt'), 'utf8'), new RegExp(oldSha));
    } finally { item.dispose(); }
  });
}

for (const mode of ['pull-failed', 'preflight-failed', 'wrong-revision']) {
  test(`${mode} fails before replacing the existing production API`, () => {
    const item = fixture();
    try {
      assert.notEqual(item.run(mode).status, 0);
      assert.equal(item.state().current, oldImage);
      assert.equal(item.calls().filter((call) => call.args.includes('up')).length, 0);
    } finally { item.dispose(); }
  });
}

test('first failed release stops only production and does not invent a rollback', () => {
  const item = fixture(false);
  try {
    const result = item.run('unhealthy');
    assert.notEqual(result.status, 0);
    assert.equal(item.state().stopped, true);
    assert.equal(fs.existsSync(path.join(item.production, 'state/current-release.txt')), false);
    assert.equal(item.calls().filter((call) => call.args.includes('stop')).length, 1);
  } finally { item.dispose(); }
});

test('rollback failure remains nonzero and reports rescue without dumping logs', () => {
  const item = fixture();
  try {
    const result = item.run('rollback-failed');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CRITICAL: rollback failed/);
    assert.equal(item.calls().filter((call) => call.args.includes('logs')).length, 0);
  } finally { item.dispose(); }
});

for (const image of ['ghcr.io/example/sinegasi/api:latest', `${newImage};touch /tmp/not-authorized`]) {
  test(`mutable/injected image is rejected before Docker: ${image.slice(-12)}`, () => {
    const item = fixture();
    try {
      assert.notEqual(item.run('', image).status, 0);
      assert.equal(item.calls().length, 0);
    } finally { item.dispose(); }
  });
}

test('missing, duplicate, mismatched, unsafe proxy and unsafe-mode approvals fail closed', () => {
  for (const change of ['missing', 'duplicate', 'mismatch', 'proxy', 'mode']) {
    const item = fixture();
    try {
      const approval = path.join(item.production, 'config/approvals', `${newSha}.txt`);
      const content = fs.readFileSync(approval, 'utf8');
      if (change === 'missing') fs.unlinkSync(approval);
      if (change === 'duplicate') fs.appendFileSync(approval, 'project_ref=pvbdiftvzoeelibxlxzb\n');
      if (change === 'mismatch') fs.writeFileSync(approval, content.replace(newImage, oldImage));
      if (change === 'proxy') fs.writeFileSync(approval, content.replace('trust_proxy_hops=1', 'trust_proxy_hops=true'));
      if (change === 'mode') fs.chmodSync(approval, 0o644);
      assert.notEqual(item.run().status, 0, change);
      assert.equal(item.calls().length, 0, change);
    } finally { item.dispose(); }
  }
});

test('entry point rejects local computer and wrong release path', () => {
  const result = spawnSync('bash', [path.join(root, 'ops/deploy-prod.sh'), newSha, newImage, manifest], { encoding: 'utf8', timeout: 5000 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STOP/);
});

test('missing, symlinked or public shared lock rejects without touching its target or Docker', () => {
  for (const change of ['missing', 'symlink', 'mode']) {
    const item = fixture();
    try {
      const lock = path.join(item.production, 'state/sinegasi-vps-deploy.lock');
      const target = path.join(item.production, 'state/protected.txt');
      fs.writeFileSync(target, 'preserve', { mode: 0o600 });
      if (change !== 'mode') fs.unlinkSync(lock);
      if (change === 'symlink') fs.symlinkSync(target, lock);
      if (change === 'mode') fs.chmodSync(lock, 0o644);
      assert.notEqual(item.run().status, 0, change);
      assert.equal(item.calls().length, 0, change);
      assert.equal(fs.readFileSync(target, 'utf8'), 'preserve');
    } finally { item.dispose(); }
  }
});

test('runtime preflight fails when workers/auth/project/CORS/proxy are unsafe without exposing secrets', () => {
  const code = fs.readFileSync(path.join(root, 'ops/production-runtime-preflight.cjs'), 'utf8');
  const safe = { environment: 'production', publicDeployment: true, allowDevelopmentAuth: false, backgroundJobsEnabled: false, ntfyEnabled: false, supabaseUrl: 'https://pvbdiftvzoeelibxlxzb.supabase.co', corsOrigins: ['https://sinegasi.pictures'], trustProxy: 1, port: 5001, host: '0.0.0.0' };
  for (const override of [{}, { backgroundJobsEnabled: true }, { backgroundJobsEnabled: undefined }, { allowDevelopmentAuth: true }, { ntfyEnabled: true }, { supabaseUrl: 'https://wrong-project.supabase.co' }, { corsOrigins: ['https://dev.example.com'] }, { trustProxy: true }]) {
    let status = 0; let stderr = '';
    vm.runInNewContext(code, {
      require: () => ({ runtimeConfig: { ...safe, ...override } }),
      process: { env: { PRODUCTION_TRUST_PROXY: '1' }, stderr: { write: (value) => { stderr += value; } }, exit: (value) => { status = value; } },
    });
    assert.equal(status, Object.keys(override).length ? 1 : 0);
    assert.ok(!stderr.includes('wrong-project') && !stderr.includes('dev.example.com'));
  }
  let stderr = '';
  vm.runInNewContext(code, { require: () => { throw new Error('private-secret-must-not-log'); }, process: { env: {}, stderr: { write: (value) => { stderr += value; } }, exit: () => {} } });
  assert.ok(!stderr.includes('private-secret-must-not-log'));
});
