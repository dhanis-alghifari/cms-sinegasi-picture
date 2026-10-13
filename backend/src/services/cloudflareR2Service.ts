import { createHash, createHmac, randomUUID } from 'node:crypto';
import { runtimeConfig } from '../config/env.js';
import type { PrivateMediaObject } from '../shared/uploads/privateMedia.js';
import { hasSupportedImageSignature } from '../shared/uploads/imageReference.js';

export interface R2UploadOptions {
  fileName: string;
  contentType: string;
  buffer: Buffer;
  folder?: string;
}

export interface R2UploadResult {
  success: boolean;
  publicUrl: string;
  key: string;
  error?: string;
}

interface R2Config {
  accountId: string;
  bucketName: string;
  publicDomain?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const R2_REGION = 'auto';
const PRESIGNED_URL_TTL_SECONDS = 900;
const PRIVATE_UPLOAD_TTL_SECONDS = 300;
const R2_REQUEST_TIMEOUT_MS = 10_000;
const MAX_VERIFIED_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PRIVATE_IMAGE_READS = 8;
let activePrivateImageReads = 0;
// These prefixes start with a letter to satisfy the existing reservation RPCs.
const STAGING_PREFIX = 'staging-v2/';
const VALIDATED_PREFIX = 'validated-v2/';

function getR2Config(requirePublicDomain = false): R2Config {
  const config: R2Config = {
    accountId: runtimeConfig.r2AccountId,
    bucketName: runtimeConfig.r2BucketName,
    publicDomain: runtimeConfig.r2PublicDomain,
    accessKeyId: runtimeConfig.r2AccessKeyId,
    secretAccessKey: runtimeConfig.r2SecretAccessKey,
  };
  if (!config.accountId || !config.bucketName || !config.accessKeyId || !config.secretAccessKey
      || (requirePublicDomain && !config.publicDomain)) {
    throw new Error('R2_STORAGE_NOT_CONFIGURED');
  }
  return config;
}

function safePathSegment(value: string): string {
  const normalized = value.trim().replace(/[\\/]+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!normalized || normalized === '.' || normalized === '..') throw new Error('R2_INVALID_KEY');
  return normalized.slice(0, 160);
}

function buildObjectKey(fileName: string, folder = 'uploads'): string {
  const safeFolder = folder
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(safePathSegment)
    .join('/') || 'uploads';
  return `${safeFolder}/${Date.now()}-${randomUUID()}-${safePathSegment(fileName)}`;
}

function encodedPath(...segments: string[]): string {
  return `/${segments.map((segment) => segment.split('/').map(encodeURIComponent).join('/')).join('/')}`;
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function signingKey(secret: string, date: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), R2_REGION), 's3'), 'aws4_request');
}

function presignedUrl(
  config: R2Config,
  key: string,
  method: 'GET' | 'HEAD' | 'PUT' | 'DELETE',
  contentType?: string,
  additionalHeaders: Readonly<Record<string, string>> = {},
  expiresInSeconds = PRESIGNED_URL_TTL_SECONDS,
): string {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const shortDate = amzDate.slice(0, 8);
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = encodedPath(config.bucketName, key);
  const credential = `${config.accessKeyId}/${shortDate}/${R2_REGION}/s3/aws4_request`;
  const headers: Record<string, string> = { ...additionalHeaders, host };
  if (contentType) headers['content-type'] = contentType;
  const headerNames = Object.keys(headers).sort();
  const signedHeaders = headerNames.join(';');
  const canonicalHeaders = headerNames.map((name) => `${name}:${headers[name]}\n`).join('');
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const scope = `${shortDate}/${R2_REGION}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signature = createHmac('sha256', signingKey(config.secretAccessKey, shortDate))
    .update(stringToSign)
    .digest('hex');
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function publicObjectUrl(config: R2Config, key: string): string {
  if (!config.publicDomain) throw new Error('R2_PUBLIC_DOMAIN_NOT_CONFIGURED');
  return `${config.publicDomain}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function normalizedObjectKey(key: string): string {
  const normalized = key.trim();
  const segments = normalized.split('/');
  if (!normalized || normalized.length > 1024 || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('R2_INVALID_KEY');
  }
  return normalized;
}

function accessObjectKey(key: string): string {
  const normalized = normalizedObjectKey(key);
  return normalized.startsWith(STAGING_PREFIX)
    ? normalizedObjectKey(`${VALIDATED_PREFIX}${normalized.slice(STAGING_PREFIX.length)}`)
    : normalized;
}

function imageContentType(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return ['image/jpeg', 'image/png', 'image/webp'].includes(normalized) ? normalized : null;
}

function responseContentLength(response: Response): number | undefined {
  const header = response.headers.get('content-length');
  if (!header || !/^[1-9][0-9]*$/.test(header)) return undefined;
  const length = Number(header);
  return Number.isSafeInteger(length) ? length : undefined;
}

async function cancelResponse(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

type ImageSnapshot =
  | { status: 'missing' | 'invalid' }
  | { status: 'valid'; bytes: Buffer };

/** The metadata and bytes come from one bounded GET, not a racy HEAD/GET pair. */
async function readImageSnapshot(
  config: R2Config,
  objectKey: string,
  contentType: string,
  expectedContentLength?: number,
): Promise<ImageSnapshot> {
  const response = await fetch(presignedUrl(config, objectKey, 'GET'), {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(R2_REQUEST_TIMEOUT_MS),
  });
  if (response.status === 404) {
    await cancelResponse(response);
    return { status: 'missing' };
  }
  const contentLength = responseContentLength(response);
  const actualType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  const contentEncoding = response.headers.get('content-encoding')?.trim().toLowerCase();
  if (response.status !== 200 || !response.body || !contentLength
      || contentLength > MAX_VERIFIED_IMAGE_BYTES || actualType !== contentType
      || (contentEncoding && contentEncoding !== 'identity')
      || (expectedContentLength !== undefined && contentLength !== expectedContentLength)) {
    await cancelResponse(response);
    return { status: 'invalid' };
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let receivedLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedLength += value.byteLength;
      if (receivedLength > contentLength || receivedLength > MAX_VERIFIED_IMAGE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { status: 'invalid' };
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (receivedLength !== contentLength) return { status: 'invalid' };
  const bytes = Buffer.concat(chunks, receivedLength);
  if (!hasSupportedImageSignature(bytes, contentType)) return { status: 'invalid' };
  return { status: 'valid', bytes };
}

/** Uploads an object through a short-lived signed PUT request. */
export async function uploadToCloudflareR2(options: R2UploadOptions): Promise<R2UploadResult> {
  let config: R2Config;
  let key = '';
  try {
    config = getR2Config(true);
    key = buildObjectKey(options.fileName, options.folder);
    const response = await fetch(presignedUrl(config, key, 'PUT', options.contentType), {
      method: 'PUT',
      headers: { 'Content-Type': options.contentType },
      body: options.buffer as unknown as BodyInit,
    });
    if (!response.ok) throw new Error(`R2_UPLOAD_FAILED_${response.status}`);
    return { success: true, publicUrl: publicObjectUrl(config, key), key };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'R2_UPLOAD_FAILED';
    return { success: false, publicUrl: '', key: key || '', error: message };
  }
}

/** Returns a real short-lived signed PUT URL; no mock URL is ever emitted. */
export function generateR2PresignedUrl(
  fileName: string,
  folder = 'students',
): { uploadUrl: string; publicUrl: string; key: string } {
  const config = getR2Config(true);
  const key = buildObjectKey(fileName, folder);
  return {
    uploadUrl: presignedUrl(config, key, 'PUT'),
    publicUrl: publicObjectUrl(config, key),
    key,
  };
}

/** Deletes a key or a URL belonging to the configured public domain. */
export async function deleteFromCloudflareR2(
  keyOrUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getR2Config();
    const rawKey = config.publicDomain && keyOrUrl.startsWith(`${config.publicDomain}/`)
      ? keyOrUrl.slice(`${config.publicDomain}/`.length)
      : keyOrUrl;
    const key = rawKey.split('/').map((segment) => decodeURIComponent(segment)).join('/');
    if (!key || key.split('/').some((segment) => segment === '.' || segment === '..')) {
      throw new Error('R2_INVALID_KEY');
    }
    const response = await fetch(presignedUrl(config, key, 'DELETE'), { method: 'DELETE' });
    if (!response.ok && response.status !== 404) throw new Error(`R2_DELETE_FAILED_${response.status}`);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'R2_DELETE_FAILED' };
  }
}

/** Creates a private-object upload URL without exposing a permanent public URL. */
export function generateR2PrivateUploadUrl(
  fileName: string,
  folder = 'contest-evidence',
  contentType?: string,
): { uploadUrl: string; key: string; expiresInSeconds: number } {
  const config = getR2Config();
  const key = normalizedObjectKey(`${STAGING_PREFIX}${buildObjectKey(fileName, folder)}`);
  // Reject a reservation if its longer final namespace would exceed the key limit.
  accessObjectKey(key);
  return {
    uploadUrl: presignedUrl(config, key, 'PUT', contentType, {}, PRIVATE_UPLOAD_TTL_SECONDS),
    key,
    expiresInSeconds: PRIVATE_UPLOAD_TTL_SECONDS,
  };
}

/** Re-signs an existing private object key for an idempotent upload retry. */
export function generateR2PrivateUploadUrlForKey(
  objectKey: string,
  contentType?: string,
): { uploadUrl: string; key: string; expiresInSeconds: number } {
  const config = getR2Config();
  const key = normalizedObjectKey(objectKey);
  if (key.startsWith(VALIDATED_PREFIX)) throw new Error('R2_VALIDATED_OBJECT_READ_ONLY');
  return {
    uploadUrl: presignedUrl(config, key, 'PUT', contentType, {}, PRIVATE_UPLOAD_TTL_SECONDS),
    key,
    expiresInSeconds: PRIVATE_UPLOAD_TTL_SECONDS,
  };
}

/** Verifies a private object after the browser completed its direct PUT upload. */
export async function inspectCloudflareR2Object(
  objectKey: string,
): Promise<{ exists: boolean; contentType?: string; contentLength?: number }> {
  const config = getR2Config();
  const response = await fetch(presignedUrl(config, normalizedObjectKey(objectKey), 'HEAD'), {
    method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(R2_REQUEST_TIMEOUT_MS),
  });
  if (response.status === 404) return { exists: false };
  if (!response.ok) throw new Error(`R2_HEAD_FAILED_${response.status}`);
  return {
    exists: true,
    contentType: response.headers.get('content-type')?.split(';')[0]?.trim() || undefined,
    contentLength: responseContentLength(response),
  };
}

/** Checks bounded stored bytes against the declared type; this is not an image decoder. */
export async function verifyCloudflareR2ImageObject(objectKey: string, contentType: string): Promise<boolean> {
  const normalizedContentType = imageContentType(contentType);
  if (!normalizedContentType) return false;
  const config = getR2Config();
  const snapshot = await readImageSnapshot(config, normalizedObjectKey(objectKey), normalizedContentType);
  return snapshot.status === 'valid';
}

/** Verifies a snapshot and promotes new uploads to a server-write-only final key. */
export async function verifyCloudflareR2ImageUpload(
  objectKey: string,
  contentType: string,
  expectedContentLength: number,
): Promise<boolean> {
  const normalizedContentType = imageContentType(contentType);
  if (!normalizedContentType || !Number.isSafeInteger(expectedContentLength)
      || expectedContentLength < 1 || expectedContentLength > MAX_VERIFIED_IMAGE_BYTES) return false;
  const config = getR2Config();
  const key = normalizedObjectKey(objectKey);
  if (!key.startsWith(STAGING_PREFIX)) {
    const snapshot = await readImageSnapshot(config, key, normalizedContentType, expectedContentLength);
    return snapshot.status === 'valid';
  }

  const finalKey = accessObjectKey(key);
  const existing = await readImageSnapshot(config, finalKey, normalizedContentType, expectedContentLength);
  if (existing.status !== 'missing') return existing.status === 'valid';
  const snapshot = await readImageSnapshot(config, key, normalizedContentType, expectedContentLength);
  if (snapshot.status !== 'valid') return false;

  const headers = {
    'content-md5': createHash('md5').update(snapshot.bytes).digest('base64'),
    'if-none-match': '*',
  };
  const response = await fetch(presignedUrl(config, finalKey, 'PUT', normalizedContentType, headers, PRIVATE_UPLOAD_TTL_SECONDS), {
    method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(R2_REQUEST_TIMEOUT_MS),
    headers: { ...headers, 'content-type': normalizedContentType },
    body: snapshot.bytes as unknown as BodyInit,
  });
  await cancelResponse(response);
  if (response.status === 412) {
    const finalized = await readImageSnapshot(config, finalKey, normalizedContentType, expectedContentLength);
    return finalized.status === 'valid';
  }
  if (response.status !== 200) throw new Error(`R2_PROMOTION_FAILED_${response.status}`);
  return true;
}

/** Server-only bounded read. Signed GET credentials never leave this adapter. */
export async function readR2PrivateImage(object: PrivateMediaObject): Promise<{ contentType: string; body: Buffer }> {
  const contentType = imageContentType(object.contentType);
  if (!contentType || !Number.isSafeInteger(object.fileSizeBytes)
      || object.fileSizeBytes < 1 || object.fileSizeBytes > MAX_VERIFIED_IMAGE_BYTES) throw new Error('R2_INVALID_MEDIA');
  const config = getR2Config();
  if (activePrivateImageReads >= MAX_PRIVATE_IMAGE_READS) throw new Error('R2_MEDIA_BUSY');
  activePrivateImageReads += 1;
  try {
    const snapshot = await readImageSnapshot(config, accessObjectKey(object.objectKey), contentType, object.fileSizeBytes);
    if (snapshot.status !== 'valid') throw new Error('R2_MEDIA_UNAVAILABLE');
    return { contentType, body: snapshot.bytes };
  } finally { activePrivateImageReads -= 1; }
}
