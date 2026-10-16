import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const newSha = 'a'.repeat(40);
const oldSha = 'b'.repeat(40);
const manifest = 'c'.repeat(64);
const archiveChecksum = '9'.repeat(64);
const newImage = `ghcr.io/example/sinegasi/api@sha256:${'d'.repeat(64)}`;
const oldImage = `ghcr.io/example/sinegasi/api@sha256:${'e'.repeat(64)}`;
const hashFile = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const mockDocker = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(process.env.MOCK_STATE, 'utf8'));
const activeImage = process.env.API_IMAGE || '';
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({ args, image: activeImage, proxyAddresses: process.env.PRODUCTION_TRUST_PROXY_ADDRESSES }) + '\\n');
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
    if (process.env.MOCK_MODE === 'schema-failed' && args.some(arg => arg.startsWith('PRODUCTION_SCHEMA_EVIDENCE_SHA256='))) process.exit(1);
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
  fs.writeFileSync(path.join(production, 'config/schema-gate.json'), '{}', { mode: 0o600 });
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
    fs.copyFileSync(path.join(root, 'ops/production-schema-preflight.cjs'), path.join(release, 'ops/production-schema-preflight.cjs'));
    fs.copyFileSync(path.join(root, 'ops/production-schema.snapshot.json'), path.join(release, 'ops/production-schema.snapshot.json'));
    fs.writeFileSync(path.join(production, 'config/approvals', `${sha}.schema.json`), '{}', { mode: 0o600 });
    fs.writeFileSync(path.join(production, 'config/approvals', `${sha}.txt`), [
      `release_sha=${sha}`, `api_image=${image}`, `schema_evidence_sha256=${manifest}`, `release_package_sha256=${archiveChecksum}`,
      'project_ref=pvbdiftvzoeelibxlxzb', 'trust_proxy_hops=1', 'database_rollback_compatible=true',
      'approval_format=3', `trust_proxy_addresses=${sha === oldSha ? '192.0.2.2' : '192.0.2.1'}`, 'approved_by=dhanis-alghifari', 'no_other_writers=true',
      'review_mode=solo-owner', 'solo_risk_accepted=true', 'media_access_mode=authenticated-proxy',
      `r2_account_id=${'a'.repeat(32)}`, 'r2_bucket=fixture-prod',
      'window_start=2026-10-13T09:00:00.000Z', 'window_end=2026-10-13T09:45:00.000Z', '',
    ].join('\n'), { mode: 0o600 });
  }
  if (previous) fs.writeFileSync(path.join(production, 'state/current-release.txt'), `release_sha=${oldSha}\napi_image=${oldImage}\nschema_evidence_sha256=${manifest}\nrelease_package_sha256=${archiveChecksum}\ndeployment_approval_sha256=${hashFile(path.join(production, 'config/approvals', `${oldSha}.txt`))}\n`, { mode: 0o600 });
  const approvedChecksum = hashFile(path.join(production, 'config/approvals', `${newSha}.txt`));
  return {
    production,
    run(mode = '', image = newImage, checksum = approvedChecksum) {
      return spawnSync('bash', ['-c', 'set -Eeuo pipefail; umask 077; source "$1"; deploy_production "$2" "$3" "$4" "$5" "$6" "$7" "$8"', 'production-release-test', path.join(root, 'ops/production-release.sh'), production, newSha, image, manifest, archiveChecksum, checksum, path.join(production, 'state/sinegasi-vps-deploy.lock')], {
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
    assert.equal(item.calls().find(call => call.args.includes('up')).proxyAddresses, '192.0.2.1');
    assert.ok(item.calls().filter(call => call.args.includes('run')).some(call => call.args.includes('PRODUCTION_TRUST_PROXY_ADDRESSES=192.0.2.1')));
    const schema = item.calls().filter(call => call.args.some(arg => arg.startsWith('PRODUCTION_SCHEMA_EVIDENCE_SHA256=')));
    assert.equal(schema.length, 1);
    assert.ok(schema[0].args.includes('--user') && schema[0].args.filter(arg => arg.endsWith(':ro')).length === 3);
    assert.ok(schema[0].args.includes('PRODUCTION_REVIEW_MODE=solo-owner'));
    assert.ok(schema[0].args.includes('PRODUCTION_R2_BUCKET=fixture-prod'));
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
      assert.deepEqual(updates.map((call) => call.proxyAddresses), ['192.0.2.1', '192.0.2.2']);
      assert.ok(updates[1].args.includes(path.join(item.production, 'releases', oldSha, 'docker-compose.prod.yml')));
      assert.match(fs.readFileSync(path.join(item.production, 'state/current-release.txt'), 'utf8'), new RegExp(oldSha));
    } finally { item.dispose(); }
  });
}

for (const mode of ['pull-failed', 'preflight-failed', 'wrong-revision', 'schema-failed']) {
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
  for (const change of ['missing', 'duplicate', 'mismatch', 'proxy', 'mode', 'package', 'writers', 'legacy', 'format', 'public', 'risk', 'review', 'owner', 'account', 'bucket', 'proxy-missing', 'proxy-wide', 'proxy-host', 'proxy-none', 'proxy-off']) {
    const item = fixture();
    try {
      const approval = path.join(item.production, 'config/approvals', `${newSha}.txt`);
      const content = fs.readFileSync(approval, 'utf8');
      if (change === 'missing') fs.unlinkSync(approval);
      if (change === 'duplicate') fs.appendFileSync(approval, 'project_ref=pvbdiftvzoeelibxlxzb\n');
      if (change === 'mismatch') fs.writeFileSync(approval, content.replace(newImage, oldImage));
      if (change === 'proxy') fs.writeFileSync(approval, content.replace('trust_proxy_hops=1', 'trust_proxy_hops=true'));
      if (change === 'mode') fs.chmodSync(approval, 0o644);
      if (change === 'package') fs.writeFileSync(approval, content.replace(archiveChecksum, '8'.repeat(64)));
      if (change === 'writers') fs.writeFileSync(approval, content.replace('no_other_writers=true', 'no_other_writers=false'));
      if (change === 'legacy') fs.writeFileSync(approval, content.replace('schema_evidence_sha256=', 'migration_manifest_sha256='));
      if (change === 'format') fs.writeFileSync(approval, content.replace('approval_format=3', 'approval_format=2'));
      if (change === 'proxy-missing') fs.writeFileSync(approval, content.replace('trust_proxy_addresses=192.0.2.1\n', ''));
      if (change === 'proxy-wide') fs.writeFileSync(approval, content.replace('trust_proxy_addresses=192.0.2.1', 'trust_proxy_addresses=192.0.2.0/24'));
      if (change === 'proxy-host') fs.writeFileSync(approval, content.replace('trust_proxy_addresses=192.0.2.1', 'trust_proxy_addresses=localhost'));
      if (change === 'proxy-none') fs.writeFileSync(approval, content.replace('trust_proxy_addresses=192.0.2.1', 'trust_proxy_addresses=none'));
      if (change === 'proxy-off') fs.writeFileSync(approval, content.replace('trust_proxy_hops=1', 'trust_proxy_hops=0'));
      if (change === 'public') fs.writeFileSync(approval, content.replace('media_access_mode=authenticated-proxy', 'media_public_domain=https://media.example.com'));
      if (change === 'risk') fs.writeFileSync(approval, content.replace('solo_risk_accepted=true', 'solo_risk_accepted=false'));
      if (change === 'review') fs.writeFileSync(approval, content.replace('review_mode=solo-owner', 'review_mode=auto'));
      if (change === 'owner') fs.writeFileSync(approval, content.replace('approved_by=dhanis-alghifari', 'approved_by=other'));
      if (change === 'account') fs.writeFileSync(approval, content.replace(`r2_account_id=${'a'.repeat(32)}`, 'r2_account_id=not-an-account'));
      if (change === 'bucket') fs.writeFileSync(approval, content.replace('r2_bucket=fixture-prod', 'r2_bucket=public.example.com'));
      // Rehash so parser/semantic tests are not merely checksum failure tests.
      const checksum = change === 'missing' ? '0'.repeat(64) : hashFile(approval);
      assert.notEqual(item.run('', newImage, checksum).status, 0, change);
      assert.equal(item.calls().length, 0, change);
    } finally { item.dispose(); }
  }
});

test('exact new approval checksum is required even for otherwise valid approvals', () => {
  const item = fixture();
  try {
    assert.notEqual(item.run('', newImage, 'f'.repeat(64)).status, 0);
    assert.equal(item.calls().length, 0);
    fs.appendFileSync(path.join(item.production, 'config/approvals', `${newSha}.txt`), '\n');
    assert.notEqual(item.run().status, 0);
    assert.equal(item.calls().length, 0);
  } finally { item.dispose(); }
});

test('independent review is retained only with a distinct approver and no solo exception', () => {
  const item = fixture(false);
  try {
    const file = path.join(item.production, 'config/approvals', `${newSha}.txt`);
    const raw = fs.readFileSync(file, 'utf8').replace('review_mode=solo-owner', 'review_mode=independent-review')
      .replace('solo_risk_accepted=true', 'solo_risk_accepted=false');
    fs.writeFileSync(file, raw);
    assert.notEqual(item.run('', newImage, hashFile(file)).status, 0);
    assert.equal(item.calls().length, 0);
    fs.writeFileSync(file, raw.replace('approved_by=dhanis-alghifari', 'approved_by=separate-reviewer'));
    assert.equal(item.run('', newImage, hashFile(file)).status, 0);
  } finally { item.dispose(); }
});

test('entry point rejects local computer and wrong release path', () => {
  const result = spawnSync('bash', [path.join(root, 'ops/deploy-prod.sh'), newSha, newImage, manifest, archiveChecksum, 'f'.repeat(64)], { encoding: 'utf8', timeout: 5000 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /STOP/);
});

test('missing, symlinked or nonprivate schema custody/evidence is refused before Docker', () => {
  for (const name of ['schema-gate.json', `approvals/${newSha}.schema.json`]) {
    for (const change of ['missing', 'mode', 'symlink']) {
      const item = fixture();
      try {
        const file = path.join(item.production, 'config', name);
        if (change === 'mode') fs.chmodSync(file, 0o644);
        else { fs.unlinkSync(file); if (change === 'symlink') fs.symlinkSync(path.join(item.production, 'config/backend.env'), file); }
        assert.notEqual(item.run().status, 0);
        assert.equal(item.calls().length, 0);
      } finally { item.dispose(); }
    }
  }
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
  const safe = { environment: 'production', publicDeployment: true, allowDevelopmentAuth: false, backgroundJobsEnabled: false, ntfyEnabled: false, supabaseUrl: 'https://pvbdiftvzoeelibxlxzb.supabase.co', corsOrigins: ['https://sinegasi.pictures'], trustProxy: 1, trustedProxyAddresses: ['192.0.2.1'], port: 5001, host: '0.0.0.0', r2AccountId: 'a'.repeat(32), r2BucketName: 'fixture-prod', r2AccessKeyId: 'fixture', r2SecretAccessKey: 'fixture', r2PublicDomain: '' };
  for (const override of [{}, { backgroundJobsEnabled: true }, { backgroundJobsEnabled: undefined }, { allowDevelopmentAuth: true }, { ntfyEnabled: true }, { supabaseUrl: 'https://wrong-project.supabase.co' }, { corsOrigins: ['https://dev.example.com'] }, { trustProxy: true }, { trustedProxyAddresses: [] }, { trustedProxyAddresses: undefined }, { trustedProxyAddresses: ['192.0.2.2'] }, { r2AccessKeyId: '' }, { r2PublicDomain: 'https://dev-media.invalid' }]) {
    let status = 0; let stderr = '';
    vm.runInNewContext(code, {
      require: () => ({ runtimeConfig: { ...safe, ...override } }),
      process: { env: { PRODUCTION_TRUST_PROXY: '1', PRODUCTION_TRUST_PROXY_ADDRESSES: '192.0.2.1', PRODUCTION_R2_ACCOUNT_ID: 'a'.repeat(32), PRODUCTION_R2_BUCKET: 'fixture-prod' }, stderr: { write: (value) => { stderr += value; } }, exit: (value) => { status = value; } },
    });
    assert.equal(status, Object.keys(override).length ? 1 : 0);
    assert.ok(!stderr.includes('wrong-project') && !stderr.includes('dev.example.com'));
  }
  let stderr = '';
  vm.runInNewContext(code, { require: () => { throw new Error('private-secret-must-not-log'); }, process: { env: {}, stderr: { write: (value) => { stderr += value; } }, exit: () => {} } });
  assert.ok(!stderr.includes('private-secret-must-not-log'));
});

test('runtime private bucket bindings and every legacy public-domain alias fail closed', () => {
  const code = fs.readFileSync(path.join(root, 'ops/production-runtime-preflight.cjs'), 'utf8');
  const safe = { environment: 'production', publicDeployment: true, allowDevelopmentAuth: false, backgroundJobsEnabled: false,
    ntfyEnabled: false, supabaseUrl: 'https://pvbdiftvzoeelibxlxzb.supabase.co', corsOrigins: ['https://sinegasi.pictures'],
    trustProxy: 1, trustedProxyAddresses: ['192.0.2.1'], port: 5001, host: '0.0.0.0', r2AccountId: 'a'.repeat(32), r2BucketName: 'fixture-prod',
    r2AccessKeyId: 'fixture', r2SecretAccessKey: 'fixture', r2PublicDomain: '' };
  const env = { PRODUCTION_TRUST_PROXY: '1', PRODUCTION_TRUST_PROXY_ADDRESSES: '192.0.2.1', PRODUCTION_R2_ACCOUNT_ID: 'a'.repeat(32), PRODUCTION_R2_BUCKET: 'fixture-prod' };
  for (const change of [{ PRODUCTION_TRUST_PROXY_ADDRESSES: '' }, { PRODUCTION_TRUST_PROXY_ADDRESSES: '192.0.2.2' },
    { PRODUCTION_R2_ACCOUNT_ID: '' }, { PRODUCTION_R2_ACCOUNT_ID: 'b'.repeat(32) },
    { PRODUCTION_R2_BUCKET: 'fixture-dev' }, { PRODUCTION_R2_BUCKET: '' }, { PRODUCTION_R2_BUCKET: '../escape' },
    ...['CLOUDFLARE_R2_PUBLIC_DOMAIN', 'R2_PUBLIC_DOMAIN', 'PRODUCTION_MEDIA_PUBLIC_DOMAIN'].map(key => ({ [key]: 'https://public.invalid' }))]) {
    let status = 0;
    vm.runInNewContext(code, { require: () => ({ runtimeConfig: safe }),
      process: { env: { ...env, ...change }, stderr: { write: () => {} }, exit: value => { status = value; } } });
    assert.equal(status, 1);
  }
});

test('runtime preflight binds disabled trust to none, never an implicit or stale address list', () => {
  const code = fs.readFileSync(path.join(root, 'ops/production-runtime-preflight.cjs'), 'utf8');
  const config = { environment: 'production', publicDeployment: true, allowDevelopmentAuth: false, backgroundJobsEnabled: false,
    ntfyEnabled: false, supabaseUrl: 'https://pvbdiftvzoeelibxlxzb.supabase.co', corsOrigins: ['https://sinegasi.pictures'],
    trustProxy: false, trustedProxyAddresses: [], port: 5001, host: '0.0.0.0', r2AccountId: 'a'.repeat(32),
    r2BucketName: 'fixture-prod', r2AccessKeyId: 'fixture', r2SecretAccessKey: 'fixture', r2PublicDomain: '' };
  for (const addresses of ['none', undefined, '', '192.0.2.1']) {
    let status = 0;
    vm.runInNewContext(code, { require: () => ({ runtimeConfig: config }),
      process: { env: { PRODUCTION_TRUST_PROXY: '0', PRODUCTION_TRUST_PROXY_ADDRESSES: addresses,
        PRODUCTION_R2_ACCOUNT_ID: 'a'.repeat(32), PRODUCTION_R2_BUCKET: 'fixture-prod' },
      stderr: { write: () => {} }, exit: value => { status = value; } } });
    assert.equal(status, addresses === 'none' ? 0 : 1);
  }
});

test('runtime preflight permits only the approved public generic ntfy configuration', () => {
  const code = fs.readFileSync(path.join(root, 'ops/production-runtime-preflight.cjs'), 'utf8');
  const safe = {
    environment: 'production', publicDeployment: true, allowDevelopmentAuth: false, backgroundJobsEnabled: false,
    supabaseUrl: 'https://pvbdiftvzoeelibxlxzb.supabase.co', corsOrigins: ['https://sinegasi.pictures'],
    trustProxy: 1, trustedProxyAddresses: ['192.0.2.1'], port: 5001, host: '0.0.0.0',
    r2AccountId: 'a'.repeat(32), r2BucketName: 'fixture-prod', r2AccessKeyId: 'fixture', r2SecretAccessKey: 'fixture', r2PublicDomain: '',
    ntfyEnabled: true, ntfyPublicGenericEnabled: true, ntfyServerUrl: 'https://ntfy.sh', ntfyTopic: 'sinegasi-notif',
    ntfyCashReviewTopic: 'sinegasi-notif', ntfyFrontendUrl: 'https://sinegasi.pictures', ntfyAccessToken: '',
  };
  function preflight(overrides = {}) {
    let status = 0;
    let stderr = '';
    vm.runInNewContext(code, {
      require: () => ({ runtimeConfig: { ...safe, ...overrides } }),
      process: {
        env: { PRODUCTION_TRUST_PROXY: '1', PRODUCTION_TRUST_PROXY_ADDRESSES: '192.0.2.1',
          PRODUCTION_R2_ACCOUNT_ID: 'a'.repeat(32), PRODUCTION_R2_BUCKET: 'fixture-prod' },
        stderr: { write: value => { stderr += value; } }, exit: value => { status = value; },
      },
    });
    assert.doesNotMatch(stderr, /PRIVATE_|unapproved|fixture/);
    return status;
  }
  assert.equal(preflight(), 0);
  assert.equal(preflight({ ntfyCashReviewTopic: '' }), 0);
  assert.equal(preflight({ ntfyEnabled: false }), 0);
  for (const overrides of [
    { ntfyEnabled: undefined }, { ntfyEnabled: 'true' },
    { ntfyPublicGenericEnabled: false }, { ntfyPublicGenericEnabled: undefined }, { ntfyPublicGenericEnabled: 'true' },
    { ntfyAccessToken: 'PRIVATE_TOKEN' }, { ntfyAccessToken: undefined },
    { ntfyServerUrl: 'http://ntfy.sh' }, { ntfyServerUrl: 'https://ntfy.sh.unapproved.invalid' },
    { ntfyServerUrl: 'https://fixture:fixture@ntfy.sh' }, { ntfyServerUrl: 'https://ntfy.sh/unapproved' },
    { ntfyServerUrl: 'https://ntfy.sh?token=PRIVATE_TOKEN' }, { ntfyServerUrl: 'https://ntfy.sh#fixture' },
    { ntfyServerUrl: 'https://ntfy.sh:444' }, { ntfyTopic: '' }, { ntfyTopic: 'sinegasi-dev-notif' },
    { ntfyCashReviewTopic: 'unapproved' }, { ntfyCashReviewTopic: undefined },
    { ntfyFrontendUrl: '' }, { ntfyFrontendUrl: 'https://unapproved.invalid' },
    { ntfyFrontendUrl: 'https://sinegasi.pictures?token=PRIVATE_TOKEN' },
    { backgroundJobsEnabled: true }, { allowDevelopmentAuth: true }, { publicDeployment: false },
  ]) assert.equal(preflight(overrides), 1);
});

test('candidate Compose pins generic production push without changing DEV or workers', () => {
  const production = fs.readFileSync(path.join(root, 'docker-compose.prod.yml'), 'utf8');
  for (const line of [
    'NTFY_PUBLIC_GENERIC_ENABLED=true', 'NTFY_SERVER_URL=https://ntfy.sh',
    'NTFY_TOPIC=sinegasi-notif', 'NTFY_CASH_REVIEW_TOPIC=sinegasi-notif',
    'NTFY_FRONTEND_URL=https://sinegasi.pictures', 'NTFY_ACCESS_TOKEN=', 'BACKGROUND_JOBS_ENABLED=false',
  ]) assert.ok(production.split('\n').some(value => value.trim() === `- ${line}`), line);
  assert.equal(production.split('\n').filter(value => /^- NTFY_ENABLED=(true|false)$/.test(value.trim())).length, 1);
  assert.equal(production.includes('sinegasi-dev-notif'), false);
  const development = fs.readFileSync(path.join(root, 'docker-compose.dev.yml'), 'utf8');
  assert.equal(development.includes('NTFY_ENABLED=true'), true);
  assert.equal(development.includes('NTFY_PUBLIC_GENERIC_ENABLED'), false);
});
