import { createHash, createHmac } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { LOGIN_KEYCHAIN, privateCommandBytes } from './productionBackupCore.js';

export const R2_CONNECTION_ACCOUNT = 'be04d420dc59ae25397156881c1c68ab';
export const R2_CONNECTION_BUCKET = 'cms-dashboard-storage';
export const R2_CONNECTION_ORIGIN = `https://${R2_CONNECTION_ACCOUNT}.r2.cloudflarestorage.com`;
export const R2_CONNECTION_SERVICES = [
  'sinegasi-prod-r2-access-key-id',
  'sinegasi-prod-r2-secret-access-key',
] as const;
const EMPTY_HASH = createHash('sha256').update('').digest('hex');
const SIGNED_HEADERS = 'host;x-amz-content-sha256;x-amz-date';
const TIMEOUT_MS = 10_000;

type FailureCode = 'INVALID_COMMAND' | 'UNSAFE_ENVIRONMENT' | 'KEYCHAIN_READ_FAILED'
  | 'INVALID_CREDENTIAL' | 'INVALID_TIMESTAMP' | 'REQUEST_OUTSIDE_SCOPE'
  | 'R2_TRANSPORT_FAILED' | 'R2_HTTP_FAILED' | 'UNEXPECTED_FAILURE';

export class R2ConnectionError extends Error {
  constructor(public readonly code: FailureCode, public readonly httpStatus?: number) {
    super(code);
  }
}

export interface R2HeadRequest {
  readonly method: 'HEAD';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface R2ConnectionState {
  keychainReadsAttempted: number;
  headBucketAttempts: number;
}

type CredentialReader = (service: typeof R2_CONNECTION_SERVICES[number]) => Promise<string>;
type HeadTransport = (request: R2HeadRequest) => Promise<number>;

export function parseR2ConnectionCommand(args: readonly string[], env: NodeJS.ProcessEnv): 'plan' | 'verify' {
  if (env.ENV_FILE_LOADING !== 'disabled' || env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
    || env.NODE_OPTIONS || env.NODE_DEBUG || env.DEBUG || env.SSLKEYLOGFILE) {
    throw new R2ConnectionError('UNSAFE_ENVIRONMENT');
  }
  if (args.length === 1 && args[0] === 'plan') return 'plan';
  if (args.length === 2 && args[0] === 'verify' && args[1] === '--keychain-ready') return 'verify';
  throw new R2ConnectionError('INVALID_COMMAND');
}

export function r2ConnectionPlan(): Record<string, unknown> {
  return {
    status: 'PRODUCTION_R2_READ_ONLY_PLAN', account: R2_CONNECTION_ACCOUNT, bucket: R2_CONNECTION_BUCKET,
    operation: 'HeadBucket', method: 'HEAD', origin: R2_CONNECTION_ORIGIN,
    keychainServices: R2_CONNECTION_SERVICES, keychainAccount: R2_CONNECTION_BUCKET,
    maximumRequests: 1, automaticRetryAllowed: false, redirectsAllowed: false, timeoutMs: TIMEOUT_MS,
    keychainAccessed: false, networkAccessed: false, envFileRead: false,
    objectsListed: false, objectContentsRead: false, objectWritesPerformed: false,
    credentialsBucketScopedVerified: false, productionChanged: false, deploymentPerformed: false,
    readyForPublicLaunch: false,
  };
}

function credential(raw: string, length: number): string {
  // security -w appends one newline; do not silently normalize pasted whitespace.
  const value = raw.replace(/\r?\n$/, '');
  if (!new RegExp(`^[a-fA-F0-9]{${length}}$`).test(value)) throw new R2ConnectionError('INVALID_CREDENTIAL');
  return value;
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

/** A fixed HeadBucket request, signed in headers; never produces a presigned URL. */
export function signedR2HeadBucket(accessKeyRaw: string, secretRaw: string, now: Date): R2HeadRequest {
  const accessKeyId = credential(accessKeyRaw, 32), secretAccessKey = credential(secretRaw, 64);
  if (!Number.isFinite(now.getTime()) || now.getUTCFullYear() < 2000 || now.getUTCFullYear() > 9999) {
    throw new R2ConnectionError('INVALID_TIMESTAMP');
  }
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const date = timestamp.slice(0, 8), host = new URL(R2_CONNECTION_ORIGIN).hostname;
  const headers: Record<string, string> = { host, 'x-amz-content-sha256': EMPTY_HASH, 'x-amz-date': timestamp };
  const canonicalHeaders = SIGNED_HEADERS.split(';').map((key) => `${key}:${headers[key]}\n`).join('');
  const canonicalRequest = ['HEAD', `/${R2_CONNECTION_BUCKET}`, '', canonicalHeaders, SIGNED_HEADERS, EMPTY_HASH].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', timestamp, scope,
    createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = hmac(dateKey, 'auto'), serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  dateKey.fill(0); regionKey.fill(0); serviceKey.fill(0); signingKey.fill(0);
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`;
  return Object.freeze({ method: 'HEAD', url: `${R2_CONNECTION_ORIGIN}/${R2_CONNECTION_BUCKET}`, headers: Object.freeze(headers) });
}

export function requireFixedR2Head(request: R2HeadRequest): void {
  const keys = Object.keys(request.headers).sort().join(';');
  const timestamp = request.headers['x-amz-date'];
  const authorization = request.headers.authorization;
  if (Object.keys(request).sort().join(';') !== 'headers;method;url'
    || request.method !== 'HEAD' || request.url !== `${R2_CONNECTION_ORIGIN}/${R2_CONNECTION_BUCKET}`
    || keys !== 'authorization;host;x-amz-content-sha256;x-amz-date'
    || request.headers.host !== new URL(R2_CONNECTION_ORIGIN).hostname
    || request.headers['x-amz-content-sha256'] !== EMPTY_HASH || !/^\d{8}T\d{6}Z$/.test(timestamp ?? '')
    || !new RegExp(`^AWS4-HMAC-SHA256 Credential=[a-fA-F0-9]{32}/${timestamp?.slice(0, 8)}/auto/s3/aws4_request, SignedHeaders=${SIGNED_HEADERS}, Signature=[a-f0-9]{64}$`).test(authorization ?? '')) {
    throw new R2ConnectionError('REQUEST_OUTSIDE_SCOPE');
  }
}

/** No ambient application configuration, shell, secret arguments, or raw diagnostics. */
export async function readR2KeychainCredential(service: typeof R2_CONNECTION_SERVICES[number]): Promise<string> {
  if (!R2_CONNECTION_SERVICES.includes(service)) throw new R2ConnectionError('REQUEST_OUTSIDE_SCOPE');
  try {
    const bytes = await privateCommandBytes('/usr/bin/security', [
      'find-generic-password', '-s', service, '-a', R2_CONNECTION_BUCKET, '-w', LOGIN_KEYCHAIN,
    ], '', 90_000, 1024);
    const value = bytes.toString('utf8');
    bytes.fill(0);
    return value;
  } catch {
    throw new R2ConnectionError('KEYCHAIN_READ_FAILED');
  }
}

/** Native HTTPS has no redirect following or retry loop; response bytes are not consumed. */
export async function sendR2HeadBucket(request: R2HeadRequest): Promise<number> {
  requireFixedR2Head(request);
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const fail = (): void => { clearTimeout(timer); reject(new R2ConnectionError('R2_TRANSPORT_FAILED')); };
    try {
      const outgoing = httpsRequest(request.url, {
        method: 'HEAD', headers: request.headers, agent: false,
        rejectUnauthorized: true, maxHeaderSize: 8192, signal: controller.signal,
      }, (response) => {
        clearTimeout(timer);
        const status = response.statusCode;
        response.on('error', () => undefined);
        response.destroy();
        if (!status || status < 100 || status > 599) fail();
        else resolve(status);
      });
      outgoing.on('error', fail);
      outgoing.end();
    } catch { fail(); }
  });
}

export async function verifyR2Connection(
  readCredential: CredentialReader,
  sendHead: HeadTransport,
  state: R2ConnectionState,
  now: () => Date = () => new Date(),
): Promise<Record<string, unknown>> {
  if (state.keychainReadsAttempted !== 0 || state.headBucketAttempts !== 0) throw new R2ConnectionError('REQUEST_OUTSIDE_SCOPE');
  const values: string[] = [];
  try {
    for (const service of R2_CONNECTION_SERVICES) {
      state.keychainReadsAttempted += 1;
      try { values.push(await readCredential(service)); }
      catch { throw new R2ConnectionError('KEYCHAIN_READ_FAILED'); }
    }
    const request = signedR2HeadBucket(values[0], values[1], now());
    requireFixedR2Head(request);
    state.headBucketAttempts += 1;
    let httpStatus: number;
    try { httpStatus = await sendHead(request); }
    catch { throw new R2ConnectionError('R2_TRANSPORT_FAILED'); }
    if (httpStatus !== 200) {
      const safeStatus = Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : undefined;
      throw new R2ConnectionError('R2_HTTP_FAILED', safeStatus);
    }
    return {
      ...r2ConnectionPlan(), status: 'PRODUCTION_R2_HEAD_BUCKET_VERIFIED', observedAt: now().toISOString(),
      httpStatus, signedHeadBucketSucceeded: true, keychainAccessed: true, networkAccessed: true,
      ...state, backendRuntimeConfigured: false, browserMediaFlowTested: false,
    };
  } finally {
    // JS strings cannot be reliably zeroized; nothing is persisted or returned.
    values.fill('');
  }
}

export function r2ConnectionFailure(error: unknown, state: R2ConnectionState): Record<string, unknown> {
  return {
    status: 'PRODUCTION_R2_CHECK_FAILED',
    code: error instanceof R2ConnectionError ? error.code : 'UNEXPECTED_FAILURE',
    ...(error instanceof R2ConnectionError && error.httpStatus !== undefined ? { httpStatus: error.httpStatus } : {}),
    ...state, automaticRetryAllowed: false, credentialsBucketScopedVerified: false,
    objectWritesPerformed: false, productionChanged: false, deploymentPerformed: false,
    readyForPublicLaunch: false,
  };
}
