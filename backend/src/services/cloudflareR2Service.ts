import { createHash, createHmac, randomUUID } from 'node:crypto';
import { runtimeConfig } from '../config/env.js';

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

function presignedUrl(config: R2Config, key: string, method: 'GET' | 'HEAD' | 'PUT' | 'DELETE', contentType?: string): string {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const shortDate = amzDate.slice(0, 8);
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = encodedPath(config.bucketName, key);
  const credential = `${config.accessKeyId}/${shortDate}/${R2_REGION}/s3/aws4_request`;
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(PRESIGNED_URL_TTL_SECONDS),
    'X-Amz-SignedHeaders': contentType ? 'content-type;host' : 'host',
  };
  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
  const canonicalHeaders = contentType ? `content-type:${contentType}\nhost:${host}\n` : `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    contentType ? 'content-type;host' : 'host',
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
  const key = buildObjectKey(fileName, folder);
  return {
    uploadUrl: presignedUrl(config, key, 'PUT', contentType),
    key,
    expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
  };
}

/** Re-signs an existing private object key for an idempotent upload retry. */
export function generateR2PrivateUploadUrlForKey(
  objectKey: string,
  contentType?: string,
): { uploadUrl: string; key: string; expiresInSeconds: number } {
  const config = getR2Config();
  const key = normalizedObjectKey(objectKey);
  return {
    uploadUrl: presignedUrl(config, key, 'PUT', contentType),
    key,
    expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
  };
}

/** Verifies a private object after the browser completed its direct PUT upload. */
export async function inspectCloudflareR2Object(
  objectKey: string,
): Promise<{ exists: boolean; contentType?: string; contentLength?: number }> {
  const config = getR2Config();
  const response = await fetch(presignedUrl(config, normalizedObjectKey(objectKey), 'HEAD'), {
    method: 'HEAD',
  });
  if (response.status === 404) return { exists: false };
  if (!response.ok) throw new Error(`R2_HEAD_FAILED_${response.status}`);
  const contentLength = Number(response.headers.get('content-length'));
  return {
    exists: true,
    contentType: response.headers.get('content-type')?.split(';')[0]?.trim() || undefined,
    contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
  };
}

/** Checks the first bytes of a private object against the declared image type. */
export async function verifyCloudflareR2ImageObject(objectKey: string, contentType: string): Promise<boolean> {
  const normalizedContentType = contentType.trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(normalizedContentType)) return false;
  const config = getR2Config();
  const response = await fetch(presignedUrl(config, normalizedObjectKey(objectKey), 'GET'), {
    method: 'GET', headers: { Range: 'bytes=0-15' },
  });
  if (!response.ok && response.status !== 206) return false;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (normalizedContentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (normalizedContentType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

/** Verifies both the stored metadata and the file signature before evidence is attached. */
export async function verifyCloudflareR2ImageUpload(
  objectKey: string,
  contentType: string,
  expectedContentLength: number,
): Promise<boolean> {
  const normalizedContentType = contentType.trim().toLowerCase();
  const object = await inspectCloudflareR2Object(objectKey);
  if (!object.exists
      || object.contentType?.toLowerCase() !== normalizedContentType
      || object.contentLength !== expectedContentLength) return false;
  return verifyCloudflareR2ImageObject(objectKey, normalizedContentType);
}

/** Issues a short-lived read URL for an attached private evidence object. */
export function generateR2PrivateAccessUrl(
  objectKey: string,
): { accessUrl: string; expiresInSeconds: number } {
  const config = getR2Config();
  return {
    accessUrl: presignedUrl(config, normalizedObjectKey(objectKey), 'GET'),
    expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
  };
}
