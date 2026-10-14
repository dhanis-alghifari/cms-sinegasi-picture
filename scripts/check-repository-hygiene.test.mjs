import assert from 'node:assert/strict';
import test from 'node:test';
import { findPathViolations, findReadmeViolations } from './check-repository-hygiene.mjs';

test('allows source, placeholder template names, migrations and non-secret evidence', () => {
  assert.deepEqual(findPathViolations([
    'README.md', 'backend/.env.example', 'frontend/.env.example',
    'backend/src/modules/auth/auth.service.ts', 'backend/src/scripts/productionBackendCustody.ts',
    'backend/src/scripts/productionR2Custody.test.ts', 'ops/provision-backend-custody-vps.py',
    'backend/src/migrations/022_password_change_atomic.sql', 'supabase/migrations/001_schema.sql',
    'ops/production-managed-integration.read-only.example.json', '.github/workflows/quality.yml',
  ]), []);
});

test('rejects private environment and custody filenames without needing their contents', () => {
  for (const file of [
    '.env', 'backend/.env.local', 'frontend/.env.production', 'ops/backend.env',
    'ops/backend.env.backup', 'ops/key.pem', 'ops/identity.key', 'ops/key.p12',
    'backup.age', 'backup.dump', 'backup.sql.gz', 'database.sqlite3',
    'first-teacher.admin.json', 'approval.deploy.json', 'config.custody.json',
    'admin.auth-attempt.json', 'admin.auth-verification-attempt.json',
  ]) assert.ok(findPathViolations([file]).length > 0, file);
});

test('rejects generated builds, dependencies, local metadata and private ops directories', () => {
  for (const file of [
    'frontend/dist/index.html', 'backend/node_modules/package/index.js',
    'frontend/build-check-123/assets/app.js', 'supabase/.temp/cli-latest',
    'supabase/.branches/current', '.aws/config', '.ssh/id', '.codegraph/index.json',
    '.codex/skills/local.json', 'ops/private/evidence.json',
  ]) assert.ok(findPathViolations([file]).length > 0, file);
});

test('catches case collisions across platforms without matching ordinary source names', () => {
  assert.equal(findPathViolations(['src/Page.tsx', 'src/page.tsx']).length, 1);
  assert.deepEqual(findPathViolations(['src/pages/Page.tsx', 'src/shared/buildConfig.ts']), []);
});

test('does not print an advertised deployment hostname in the violation', () => {
  for (const host of ['preview-example.pages.dev', 'private-demo.duckdns.org', 'pub-example.r2.dev']) {
    const result = findReadmeViolations('README.md', `# Demo\nhttps://${host}`);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes('README.md:2'));
    assert.ok(!result[0].includes(host));
  }
});

test('allows loopback, production targets, official docs and non-resolving placeholder hosts', () => {
  assert.deepEqual(findReadmeViolations('README.md', [
    'http://127.0.0.1:5173', 'http://localhost:5001/api/health',
    'https://api.sinegasi.pictures', 'https://docs.github.com/en/actions',
    'https://<hash>.<project>.pages.dev',
  ].join('\n')), []);
});
