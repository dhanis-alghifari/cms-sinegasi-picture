import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { privateCommandBytes } from './productionBackupCore.js';
import { R2_CONNECTION_ACCOUNT, R2_CONNECTION_BUCKET, R2_CONNECTION_SERVICES } from './productionR2ConnectionCore.js';

export const R2_CUSTODY_HOST = '43.157.242.8';
export const R2_CUSTODY_DESTINATION = '/opt/sinegasi-prod/config/r2.env';
export const R2_CUSTODY_SSH_ARGS = [
  '-4', '-F', '/dev/null', '-i', '/Users/memberid/.ssh/id_ed25519',
  '-o', 'IdentitiesOnly=yes', '-o', 'PreferredAuthentications=publickey',
  '-o', 'StrictHostKeyChecking=yes', '-o', 'UpdateHostKeys=no', '-o', 'BatchMode=yes',
  '-o', 'UserKnownHostsFile=/Users/memberid/.ssh/known_hosts', '-o', 'GlobalKnownHostsFile=/dev/null',
  '-o', 'ForwardAgent=no', '-o', 'ClearAllForwardings=yes', '-o', 'RequestTTY=no',
  '-o', 'ConnectionAttempts=1', '-o', 'ConnectTimeout=10',
  '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=1',
  'ubuntu@43.157.242.8',
] as const;

type CustodyCode = 'INVALID_COMMAND' | 'UNSAFE_ENVIRONMENT' | 'STATE_REUSED'
  | 'VPS_PREFLIGHT_FAILED' | 'INVALID_CREDENTIAL' | 'KEYCHAIN_READ_FAILED'
  | 'TRANSFER_OUTCOME_UNCERTAIN' | 'UNEXPECTED_FAILURE';

export class R2CustodyError extends Error {
  constructor(public readonly code: CustodyCode) { super(code); }
}

export interface R2CustodyState {
  inspectionAttempts: number;
  keychainReadsAttempted: number;
  transferAttempts: number;
  transferAcknowledged: boolean;
}

type RemoteAction = 'inspect' | 'write';
type RemoteReceiver = (action: RemoteAction, input: Buffer) => Promise<unknown>;
type CredentialReader = (service: typeof R2_CONNECTION_SERVICES[number]) => Promise<string>;

export function parseR2CustodyCommand(args: readonly string[], env: NodeJS.ProcessEnv): 'plan' | 'inspect' | 'apply' {
  if (env.ENV_FILE_LOADING !== 'disabled' || env.NODE_OPTIONS || env.NODE_DEBUG || env.DEBUG || env.SSLKEYLOGFILE
    || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new R2CustodyError('UNSAFE_ENVIRONMENT');
  if (args.length === 1 && args[0] === 'plan') return 'plan';
  if (args.length === 1 && args[0] === 'inspect') return 'inspect';
  if (args.length === 3 && args[0] === 'apply' && args[1] === '--transfer-approved' && args[2] === '--keychain-ready') return 'apply';
  throw new R2CustodyError('INVALID_COMMAND');
}

export function r2CustodyPlan(): Record<string, unknown> {
  return {
    status: 'PRODUCTION_R2_CUSTODY_PLAN', host: R2_CUSTODY_HOST, destination: R2_CUSTODY_DESTINATION,
    account: R2_CONNECTION_ACCOUNT, bucket: R2_CONNECTION_BUCKET, owner: 'ubuntu', mode: '0600', directoryMode: '0700',
    keychainServices: R2_CONNECTION_SERVICES, maximumTransfers: 1, automaticRetryAllowed: false,
    existingFileOverwriteAllowed: false, transport: 'SSH_STDIN', strictHostKeyChecking: true,
    temporaryFile: 'PRIVATE_RANDOM_IN_DESTINATION_DIRECTORY_ATOMIC_NO_REPLACE_PUBLISH',
    keychainAccessed: false, networkAccessed: false, configurationContentsRead: false,
    credentialsTransferred: false, vpsCustodyChanged: false, backendRuntimeConfigured: false,
    databaseAccessed: false, r2ObjectOperationsPerformed: false, deploymentPerformed: false, readyForPublicLaunch: false,
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid metadata');
  return value as Record<string, unknown>;
}

export function requireCustodyPreflight(value: unknown): void {
  const info = record(value);
  if (Object.keys(info).sort().join(';') !== 'configurationContentsRead;destination;destinationAbsent;directoryCreationRequired;owner;privateParentsReady;status'
    || info.status !== 'R2_CUSTODY_DESTINATION_READY' || info.destination !== R2_CUSTODY_DESTINATION
    || info.owner !== 'ubuntu' || info.destinationAbsent !== true || info.configurationContentsRead !== false
    || typeof info.privateParentsReady !== 'boolean' || info.directoryCreationRequired !== !info.privateParentsReady) throw new Error('Invalid metadata');
}

export function r2CustodyPayload(accessKeyRaw: string, secretRaw: string): Buffer {
  const accessKey = accessKeyRaw.replace(/\r?\n$/, '');
  const secret = secretRaw.replace(/\r?\n$/, '');
  if (!/^[a-fA-F0-9]{32}$/.test(accessKey) || !/^[a-fA-F0-9]{64}$/.test(secret)) throw new R2CustodyError('INVALID_CREDENTIAL');
  return Buffer.from(`CLOUDFLARE_R2_ACCOUNT_ID=${R2_CONNECTION_ACCOUNT}\nCLOUDFLARE_R2_BUCKET_NAME=${R2_CONNECTION_BUCKET}\n`
    + `CLOUDFLARE_R2_ACCESS_KEY_ID=${accessKey}\nCLOUDFLARE_R2_SECRET_ACCESS_KEY=${secret}\n`, 'ascii');
}

function requireCustodyReceipt(value: unknown, bytes: number): void {
  const info = record(value);
  if (Object.keys(info).sort().join(';') !== 'bytes;contentReadBack;destination;directoryMode;existingFileOverwritten;mode;nlink;owner;status;temporaryRemoved'
    || info.status !== 'R2_CUSTODY_CREATED' || info.destination !== R2_CUSTODY_DESTINATION || info.owner !== 'ubuntu'
    || info.mode !== '0600' || info.directoryMode !== '0700' || info.bytes !== bytes || info.nlink !== 1
    || info.contentReadBack !== false || info.existingFileOverwritten !== false || info.temporaryRemoved !== true) throw new Error('Invalid metadata');
}

export async function provisionR2Custody(readCredential: CredentialReader, remote: RemoteReceiver,
  state: R2CustodyState): Promise<Record<string, unknown>> {
  if (state.inspectionAttempts || state.keychainReadsAttempted || state.transferAttempts || state.transferAcknowledged) throw new R2CustodyError('STATE_REUSED');
  state.inspectionAttempts += 1;
  try { requireCustodyPreflight(await remote('inspect', Buffer.alloc(0))); }
  catch { throw new R2CustodyError('VPS_PREFLIGHT_FAILED'); }
  const values: string[] = [];
  let payload: Buffer | undefined;
  try {
    for (const service of R2_CONNECTION_SERVICES) {
      state.keychainReadsAttempted += 1;
      try { values.push(await readCredential(service)); }
      catch { throw new R2CustodyError('KEYCHAIN_READ_FAILED'); }
    }
    payload = r2CustodyPayload(values[0], values[1]);
    state.transferAttempts += 1;
    try { requireCustodyReceipt(await remote('write', payload), payload.length); }
    catch { throw new R2CustodyError('TRANSFER_OUTCOME_UNCERTAIN'); }
    state.transferAcknowledged = true;
    return {
      ...r2CustodyPlan(), status: 'PRODUCTION_R2_VPS_CUSTODY_CREATED', observedAt: new Date().toISOString(),
      ...state, bytes: payload.length, keychainAccessed: true, networkAccessed: true,
      credentialsTransferred: true, vpsCustodyChanged: true, contentReadBack: false,
      fileReadBackIntegrityVerified: false, existingFileOverwritten: false,
    };
  } finally { payload?.fill(0); values.fill(''); }
}

export async function createR2CustodyReceiver(): Promise<RemoteReceiver> {
  const source = await readFile(resolve(__dirname, '../../../ops/provision-r2-custody-vps.py'), 'utf8');
  const quotedSource = `'${source.replaceAll("'", "'\\''")}'`;
  return async (action, input) => {
    if (!['inspect', 'write'].includes(action) || (action === 'inspect' && input.length !== 0)
      || (action === 'write' && (input.length < 1 || input.length > 1024))) throw new Error('Outside custody scope');
    const command = `/usr/bin/sudo -n -- /usr/bin/python3 -I -c ${quotedSource} ${action}`;
    const bytes = await privateCommandBytes('/usr/bin/ssh', [...R2_CUSTODY_SSH_ARGS, command], input, 45_000, 4096);
    try { return JSON.parse(bytes.toString('utf8')) as unknown; }
    finally { bytes.fill(0); }
  };
}

export function r2CustodyFailure(error: unknown, state: R2CustodyState): Record<string, unknown> {
  return {
    status: 'PRODUCTION_R2_CUSTODY_FAILED', code: error instanceof R2CustodyError ? error.code : 'UNEXPECTED_FAILURE',
    ...state, automaticRetryAllowed: false, destinationMayExist: state.transferAttempts > 0,
    credentialsMayHaveTransferred: state.transferAttempts > 0, configurationContentsRead: false,
    databaseAccessed: false, r2ObjectOperationsPerformed: false, backendRuntimeConfigured: false,
    deploymentPerformed: false, readyForPublicLaunch: false,
  };
}
