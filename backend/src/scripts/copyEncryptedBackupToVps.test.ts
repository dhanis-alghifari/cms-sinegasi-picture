import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, link, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COPY_FILES, quoteCopyShell, readCopyArtifact, validateCopyArtifacts, validateCopyId } from './copyEncryptedBackupToVps.js';
import { BACKUP_PROJECT, privateCommandBytes } from './productionBackupCore.js';

const id = '2026-10-10T16-33-02-349Z';
const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
function fixture(): Record<typeof COPY_FILES[number], Buffer> {
  const archive = Buffer.from('age-encryption.org/v1\nsynthetic ciphertext archive');
  const metadata = Buffer.from('age-encryption.org/v1\nsynthetic ciphertext metadata');
  return {
    'database.dump.age': archive, 'metadata.json.age': metadata,
    'receipt.json': Buffer.from(JSON.stringify({ project: BACKUP_PROJECT, id, encrypted: true, productionChanged: false,
      archive: { sha256: digest(archive), bytes: archive.length }, metadata: { sha256: digest(metadata), bytes: metadata.length } })),
    'public-restore-verification.json': Buffer.from(JSON.stringify({ status: 'PUBLIC_APPLICATION_RESTORE_VERIFIED',
      project: BACKUP_PROJECT, id, productionChanged: false, archiveSha256: digest(archive),
      checks: { tableRowsAndRlsMatch: true, columnsConstraintsIndexesFunctionsTriggersEnumsPoliciesMatch: true, publicExtensionsMatch: true } })),
  };
}

test('copy allowlist contains only two encrypted artifacts and two non-secret proof records', () => {
  assert.deepEqual(COPY_FILES, ['database.dump.age', 'metadata.json.age', 'receipt.json', 'public-restore-verification.json']);
  assert.doesNotThrow(() => validateCopyArtifacts(id, fixture()));
});

for (const value of ['', '../other', id + '/../../key', id + "';touch /tmp/attack;#", '2026-10-10']) {
  test(`reject invalid copy ID ${JSON.stringify(value)}`, () => assert.throws(() => validateCopyId(value), /INVALID_BACKUP_ID/));
}

test('ciphertext corruption, missing age header and malformed JSON fail closed', () => {
  for (const name of COPY_FILES) {
    const files = fixture();
    files[name] = Buffer.from('synthetic-secret-do-not-echo');
    assert.throws(() => validateCopyArtifacts(id, files), /BACKUP_INTEGRITY_OR_RESTORE_PROOF_FAILED/);
  }
});

for (const [name, changed] of [
  ['wrong project', { project: 'other-project' }], ['wrong id', { id: '2026-10-09T16-33-02-349Z' }],
  ['unencrypted receipt', { encrypted: false }], ['changed production', { productionChanged: true }],
] as const) test(`reject ${name}`, () => {
  const files = fixture();
  files['receipt.json'] = Buffer.from(JSON.stringify({ ...JSON.parse(files['receipt.json'].toString('utf8')), ...changed }));
  assert.throws(() => validateCopyArtifacts(id, files), /BACKUP_INTEGRITY_OR_RESTORE_PROOF_FAILED/);
});

test('failed or unrelated restore evidence is not promoted by a VPS copy', () => {
  for (const changed of [{ status: 'RESTORE_FAILED' }, { project: 'other-project' }, { archiveSha256: '0'.repeat(64) },
    { checks: { tableRowsAndRlsMatch: true, columnsConstraintsIndexesFunctionsTriggersEnumsPoliciesMatch: false, publicExtensionsMatch: true } }]) {
    const files = fixture();
    files['public-restore-verification.json'] = Buffer.from(JSON.stringify({
      ...JSON.parse(files['public-restore-verification.json'].toString('utf8')), ...changed,
    }));
    assert.throws(() => validateCopyArtifacts(id, files), /BACKUP_INTEGRITY_OR_RESTORE_PROOF_FAILED/);
  }
});

test('shell quoting preserves literal receiver script, not substitutions', async () => {
  const value = "literal ' $(printf injected) `printf injected`\nline";
  assert.equal((await privateCommandBytes('/bin/bash', ['-c', `printf %s ${quoteCopyShell(value)}`])).toString('utf8'), value);
});

test('only private owned regular unlinked artifacts can be read', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sinegasi-copy-test-'));
  const file = join(directory, 'artifact');
  try {
    await writeFile(file, 'ciphertext-test', { mode: 0o600, flag: 'wx' });
    assert.equal((await readCopyArtifact(file)).toString('utf8'), 'ciphertext-test');
    await chmod(file, 0o644);
    await assert.rejects(readCopyArtifact(file), /UNSAFE_BACKUP_ARTIFACT/);
    await chmod(file, 0o600);
    await symlink(file, join(directory, 'symlink'));
    await assert.rejects(readCopyArtifact(join(directory, 'symlink')));
    await link(file, join(directory, 'hardlink'));
    await assert.rejects(readCopyArtifact(file), /UNSAFE_BACKUP_ARTIFACT/);
  } finally { await rm(directory, { recursive: true }); }
});

test('GNU dd exclusive creation is a conversion, not an output flag; resume requires empty destination', async () => {
  const receiver = await readFile(join(__dirname, '../../../ops/copy-encrypted-backup-vps.sh'), 'utf8');
  assert.match(receiver, /oflag=nofollow conv=excl,fsync/);
  assert.doesNotMatch(receiver, /oflag=excl/);
  assert.match(receiver, /find "\$destination" -mindepth 1 -maxdepth 1 -print -quit/);
  assert.doesNotMatch(receiver, /rm |rmdir |chmod |chown /);
});
