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
  publicDomain: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const R2_REGION = 'auto';
const PRESIGNED_URL_TTL_SECONDS = 900;

function getR2Config(): R2Config {
  const config: R2Config = {
    accountId: runtimeConfig.r2AccountId,
    bucketName: runtimeConfig.r2BucketName,
    publicDomain: runtimeConfig.r2PublicDomain,
    accessKeyId: runtimeConfig.r2AccessKeyId,
    secretAccessKey: runtimeConfig.r2SecretAccessKey,
  };
  if (Object.values(config).some((value) => !value)) {
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

function presignedUrl(config: R2Config, key: string, method: 'PUT' | 'DELETE'): string {
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
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
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
  return `${config.publicDomain}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** Uploads an object through a short-lived signed PUT request. */
export async function uploadToCloudflareR2(options: R2UploadOptions): Promise<R2UploadResult> {
  let config: R2Config;
  let key = '';
  try {
    config = getR2Config();
    key = buildObjectKey(options.fileName, options.folder);
    const response = await fetch(presignedUrl(config, key, 'PUT'), {
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
  const config = getR2Config();
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
    const rawKey = keyOrUrl.startsWith(`${config.publicDomain}/`)
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
