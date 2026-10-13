import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LOGIN_KEYCHAIN, privateCommandBytes } from './productionBackupCore.js';
import { INTEGRATION_ORIGIN, INTEGRATION_PROJECT, INTEGRATION_SERVICE_KEY, validateIntegrationKey } from './productionManagedIntegrationCore.js';
import { R2_CONNECTION_ACCOUNT, R2_CONNECTION_BUCKET, R2_CONNECTION_SERVICES } from './productionR2ConnectionCore.js';
import { R2_CUSTODY_HOST, R2_CUSTODY_SSH_ARGS, type R2CustodyState } from './productionR2CustodyCore.js';

export const BACKEND_CUSTODY_DESTINATION = '/opt/sinegasi-prod/config/backend.env';
export const BACKEND_CUSTODY_ITEMS = [
  { service: INTEGRATION_SERVICE_KEY, account: INTEGRATION_PROJECT },
  ...R2_CONNECTION_SERVICES.map(service => ({ service, account: R2_CONNECTION_BUCKET })),
] as const;

export const BACKEND_CUSTODY_FIXED_ENV = Object.freeze({
  ENV_FILE_LOADING: 'disabled', NODE_ENV: 'production', PUBLIC_DEPLOYMENT: 'true',
  HOST: '0.0.0.0', PORT: '5001', CORS_ORIGINS: 'https://sinegasi.pictures',
  ALLOW_DEV_AUTH: 'false', BACKGROUND_JOBS_ENABLED: 'false', NTFY_ENABLED: 'false',
  TRUST_PROXY: '0', SUPABASE_URL: INTEGRATION_ORIGIN,
  CLOUDFLARE_R2_ACCOUNT_ID: R2_CONNECTION_ACCOUNT, CLOUDFLARE_R2_BUCKET_NAME: R2_CONNECTION_BUCKET,
  CLOUDFLARE_R2_PUBLIC_DOMAIN: '', R2_PUBLIC_DOMAIN: '', PRODUCTION_MEDIA_PUBLIC_DOMAIN: '',
});

type BackendCustodyCode = 'INVALID_COMMAND' | 'UNSAFE_ENVIRONMENT' | 'STATE_REUSED'
  | 'VPS_PREFLIGHT_FAILED' | 'INVALID_CREDENTIAL' | 'KEYCHAIN_READ_FAILED'
  | 'TRANSFER_OUTCOME_UNCERTAIN' | 'UNEXPECTED_FAILURE';
export class BackendCustodyError extends Error {
  constructor(public readonly code: BackendCustodyCode) { super(code); }
}

type KeychainItem = typeof BACKEND_CUSTODY_ITEMS[number];
type RemoteReceiver = (action: 'inspect' | 'write', input: Buffer) => Promise<unknown>;
type CredentialReader = (item: KeychainItem) => Promise<string>;
export type BackendCustodyState = R2CustodyState;

export function parseBackendCustodyCommand(args: readonly string[], env: NodeJS.ProcessEnv): 'plan' | 'inspect' | 'apply' {
  if (env.ENV_FILE_LOADING !== 'disabled' || env.NODE_OPTIONS || env.NODE_DEBUG || env.DEBUG || env.SSLKEYLOGFILE
    || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new BackendCustodyError('UNSAFE_ENVIRONMENT');
  if (args.length === 1 && args[0] === 'plan') return 'plan';
  if (args.length === 1 && args[0] === 'inspect') return 'inspect';
  if (args.length === 4 && args[0] === 'apply' && args[1] === '--backend-custody-approved'
    && args[2] === '--generate-app-jwt-approved' && args[3] === '--keychain-ready') return 'apply';
  throw new BackendCustodyError('INVALID_COMMAND');
}

export function backendCustodyPlan(): Record<string, unknown> {
  return {
    status: 'PRODUCTION_BACKEND_CUSTODY_OFFLINE_PLAN', host: R2_CUSTODY_HOST, destination: BACKEND_CUSTODY_DESTINATION,
    project: INTEGRATION_PROJECT, bucket: R2_CONNECTION_BUCKET, owner: 'ubuntu', mode: '0600', directoryMode: '0700',
    keychainItems: BACKEND_CUSTODY_ITEMS, fixedEnvironment: BACKEND_CUSTODY_FIXED_ENV,
    newAppJwt: { generatedAt: 'VPS_RECEIVER_BEFORE_FILE_PUBLISH', randomBytes: 64, printed: false },
    transport: 'SSH_STDIN', strictHostKeyChecking: true, maximumTransfers: 1, automaticRetryAllowed: false,
    existingFileOverwriteAllowed: false, r2CustodyFileContentsRead: false, proxyTopologyApproved: false,
    supabaseKeyAuthenticityVerified: false, managedSupabaseSigningKeyChanged: false,
    keychainAccessed: false, networkAccessed: false, configurationContentsRead: false,
    credentialsTransferred: false, vpsCustodyChanged: false, backendRuntimeConfigured: false,
    databaseAccessed: false, r2ObjectOperationsPerformed: false, deploymentPerformed: false, readyForPublicLaunch: false,
  };
}

function exactMetadata(value: unknown, expected: Readonly<Record<string, unknown>>, code: BackendCustodyCode): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BackendCustodyError(code);
  const info = value as Record<string, unknown>;
  if (Object.keys(info).sort().join(';') !== Object.keys(expected).sort().join(';')
    || Object.entries(expected).some(([key, item]) => info[key] !== item)) throw new BackendCustodyError(code);
}

export function requireBackendCustodyPreflight(value: unknown): void {
  exactMetadata(value, {
    status: 'BACKEND_CUSTODY_DESTINATION_READY', destination: BACKEND_CUSTODY_DESTINATION, owner: 'ubuntu',
    destinationAbsent: true, privateParentsReady: true, r2CustodyMetadataVerified: true, configurationContentsRead: false,
  }, 'VPS_PREFLIGHT_FAILED');
}

function normalizedCredential(item: KeychainItem, raw: string): string {
  const value = raw.replace(/\r?\n$/, '');
  if (item.service === INTEGRATION_SERVICE_KEY) {
    try {
      if (value !== value.trim()) throw new Error('Invalid whitespace');
      return validateIntegrationKey(value, 'service_role');
    } catch { throw new BackendCustodyError('INVALID_CREDENTIAL'); }
  }
  const length = item.service === R2_CONNECTION_SERVICES[0] ? 32 : 64;
  if (!new RegExp(`^[a-fA-F0-9]{${length}}$`).test(value)) throw new BackendCustodyError('INVALID_CREDENTIAL');
  return value;
}

export function backendCustodyPayload(values: readonly string[]): Buffer {
  if (values.length !== 3) throw new BackendCustodyError('INVALID_CREDENTIAL');
  const [supabaseKey, r2AccessKeyId, r2SecretAccessKey] = BACKEND_CUSTODY_ITEMS.map((item, index) => normalizedCredential(item, values[index]));
  return Buffer.from(JSON.stringify({ supabaseKey, r2AccessKeyId, r2SecretAccessKey }), 'ascii');
}

function expectedFileBytes(values: readonly string[]): number {
  const fixed = Object.entries(BACKEND_CUSTODY_FIXED_ENV).map(([key, value]) => `${key}=${value}\n`).join('');
  return Buffer.byteLength(fixed + `SUPABASE_SERVICE_ROLE_KEY=${values[0]}\nJWT_SECRET=${'0'.repeat(128)}\n`
    + `CLOUDFLARE_R2_ACCESS_KEY_ID=${values[1]}\nCLOUDFLARE_R2_SECRET_ACCESS_KEY=${values[2]}\n`, 'ascii');
}

export async function provisionBackendCustody(readCredential: CredentialReader, remote: RemoteReceiver,
  state: BackendCustodyState): Promise<Record<string, unknown>> {
  if (state.inspectionAttempts || state.keychainReadsAttempted || state.transferAttempts || state.transferAcknowledged) {
    throw new BackendCustodyError('STATE_REUSED');
  }
  state.inspectionAttempts++;
  try { requireBackendCustodyPreflight(await remote('inspect', Buffer.alloc(0))); }
  catch { throw new BackendCustodyError('VPS_PREFLIGHT_FAILED'); }
  const values: string[] = [];
  let payload: Buffer | undefined;
  try {
    for (const item of BACKEND_CUSTODY_ITEMS) {
      state.keychainReadsAttempted++;
      let raw: string;
      try { raw = await readCredential(item); }
      catch { throw new BackendCustodyError('KEYCHAIN_READ_FAILED'); }
      values.push(normalizedCredential(item, raw));
    }
    payload = backendCustodyPayload(values);
    const bytes = expectedFileBytes(values);
    state.transferAttempts++;
    try {
      exactMetadata(await remote('write', payload), {
        status: 'BACKEND_CUSTODY_CREATED', destination: BACKEND_CUSTODY_DESTINATION, owner: 'ubuntu',
        mode: '0600', directoryMode: '0700', bytes, nlink: 1, contentReadBack: false,
        existingFileOverwritten: false, temporaryRemoved: true, appJwtGenerated: true, appJwtRandomBytes: 64,
        r2CustodyMetadataUnchanged: true, managedSupabaseSigningKeyChanged: false,
      }, 'TRANSFER_OUTCOME_UNCERTAIN');
    } catch { throw new BackendCustodyError('TRANSFER_OUTCOME_UNCERTAIN'); }
    state.transferAcknowledged = true;
    return {
      ...backendCustodyPlan(), status: 'PRODUCTION_BACKEND_VPS_CUSTODY_CREATED', observedAt: new Date().toISOString(),
      ...state, bytes, keychainAccessed: true, networkAccessed: true, credentialsTransferred: true,
      vpsCustodyChanged: true, appJwtGenerated: true, fileReadBackIntegrityVerified: false,
    };
  } finally { payload?.fill(0); values.fill(''); }
}

export async function readBackendCustodyCredential(item: KeychainItem): Promise<string> {
  if (!BACKEND_CUSTODY_ITEMS.some(allowed => allowed.service === item.service && allowed.account === item.account)) {
    throw new BackendCustodyError('INVALID_CREDENTIAL');
  }
  let bytes: Buffer | undefined;
  try {
    bytes = await privateCommandBytes('/usr/bin/security', [
      'find-generic-password', '-s', item.service, '-a', item.account, '-w', LOGIN_KEYCHAIN,
    ], '', 90_000, 4098);
    return bytes.toString('utf8');
  } catch { throw new BackendCustodyError('KEYCHAIN_READ_FAILED'); }
  finally { bytes?.fill(0); }
}

export async function createBackendCustodyReceiver(): Promise<RemoteReceiver> {
  const source = await readFile(resolve(__dirname, '../../../ops/provision-backend-custody-vps.py'), 'utf8');
  const quotedSource = `'${source.replaceAll("'", "'\\''")}'`;
  return async (action, input) => {
    if (!['inspect', 'write'].includes(action) || (action === 'inspect' && input.length !== 0)
      || (action === 'write' && (input.length < 1 || input.length > 8192))) throw new BackendCustodyError('INVALID_COMMAND');
    const command = `/usr/bin/sudo -n -- /usr/bin/python3 -I -c ${quotedSource} ${action}`;
    const bytes = await privateCommandBytes('/usr/bin/ssh', [...R2_CUSTODY_SSH_ARGS, command], input, 45_000, 4096);
    try { return JSON.parse(bytes.toString('utf8')) as unknown; }
    finally { bytes.fill(0); }
  };
}

export function backendCustodyFailure(error: unknown, state: BackendCustodyState): Record<string, unknown> {
  return {
    status: 'PRODUCTION_BACKEND_CUSTODY_FAILED', code: error instanceof BackendCustodyError ? error.code : 'UNEXPECTED_FAILURE',
    ...state, automaticRetryAllowed: false, destinationMayExist: state.transferAttempts > 0,
    credentialsMayHaveTransferred: state.transferAttempts > 0, appJwtMayHaveBeenGenerated: state.transferAttempts > 0,
    configurationContentsRead: false, databaseAccessed: false, r2ObjectOperationsPerformed: false,
    managedSupabaseSigningKeyChanged: false, backendRuntimeConfigured: false, deploymentPerformed: false, readyForPublicLaunch: false,
  };
}
