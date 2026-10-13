import { lstat } from 'node:fs/promises';
import { basename } from 'node:path';
import { AUTH_ACCOUNT, authDigest, authRequire, AuthExecutorError, type AuthExecutorBindings } from './productionAuthExecutorCore.js';
import { persistAuthCustody } from './productionAuthCustody.js';
import { AUTH_VERIFICATION_ATTEMPT_FILE, AUTH_VERIFICATION_OPERATION, type VerificationCredentials } from './productionAuthVerificationCore.js';
import { BACKUP_PROJECT } from './productionBackupCore.js';

/** Any prior/partial/symlink attempt is terminal, even with a new approval checksum. */
export async function requireNoVerificationAttempt(file: string): Promise<void> {
  try { await lstat(file); }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw new AuthExecutorError('AUTH_VERIFICATION_ATTEMPT_STATE_UNAVAILABLE');
  }
  throw new AuthExecutorError('AUTH_VERIFICATION_PREVIOUS_ATTEMPT_INSPECT_NO_RETRY');
}
export async function persistVerificationAttempt(file: string, checksum: string, bindings: AuthExecutorBindings,
  credentials: Pick<VerificationCredentials, 'passwordCustodySha256' | 'temporaryCredentialSha256'>): Promise<void> {
  // Copy fields explicitly: credential strings and provider tokens must never enter this new latch.
  authRequire(basename(file) === basename(AUTH_VERIFICATION_ATTEMPT_FILE) && authDigest(checksum)
    && /^[a-f0-9]{40}$/.test(bindings.releaseSha) && authDigest(bindings.runnerSourceSha256) && authDigest(bindings.packageSha256)
    && authDigest(credentials.passwordCustodySha256) && authDigest(credentials.temporaryCredentialSha256),
  'AUTH_VERIFICATION_NEW_ATTEMPT_BINDINGS_REQUIRED');
  await persistAuthCustody(file, { format: 1, operation: AUTH_VERIFICATION_OPERATION, project: BACKUP_PROJECT, ...AUTH_ACCOUNT,
    approvalSha256: checksum, releaseSha: bindings.releaseSha, runnerSourceSha256: bindings.runnerSourceSha256, packageSha256: bindings.packageSha256,
    passwordCustodySha256: credentials.passwordCustodySha256, temporaryCredentialSha256: credentials.temporaryCredentialSha256,
    createdAt: new Date().toISOString(), requiredAuthVersion: 2, passwordMutationAllowed: false,
    executionState: 'prepared-counter-outcome-must-be-inspected', automaticRetryAllowed: false });
}
