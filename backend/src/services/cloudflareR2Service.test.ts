import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeConfig } from '../config/env.js';
import {
  generateR2PrivateAccessUrl,
  generateR2PrivateUploadUrl,
  generateR2PresignedUrl,
  uploadToCloudflareR2,
  verifyCloudflareR2ImageUpload,
} from './cloudflareR2Service.js';

test('R2 adapter fails closed instead of returning a fake upload URL when unconfigured', async () => {
  const original = {
    r2AccountId: runtimeConfig.r2AccountId,
    r2BucketName: runtimeConfig.r2BucketName,
    r2PublicDomain: runtimeConfig.r2PublicDomain,
    r2AccessKeyId: runtimeConfig.r2AccessKeyId,
    r2SecretAccessKey: runtimeConfig.r2SecretAccessKey,
  };
  Object.assign(runtimeConfig, {
    r2AccountId: '',
    r2BucketName: '',
    r2PublicDomain: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
  });
  try {
    const result = await uploadToCloudflareR2({
      fileName: 'portrait.png',
      contentType: 'image/png',
      buffer: Buffer.from('test'),
    });
    assert.equal(result.success, false);
    assert.equal(result.error, 'R2_STORAGE_NOT_CONFIGURED');
    assert.throws(() => generateR2PresignedUrl('../portrait.png'), /R2_STORAGE_NOT_CONFIGURED/);
  } finally {
    Object.assign(runtimeConfig, original);
  }
});

test('private contest evidence URLs do not require or expose a public domain', () => {
  const original = {
    r2AccountId: runtimeConfig.r2AccountId,
    r2BucketName: runtimeConfig.r2BucketName,
    r2PublicDomain: runtimeConfig.r2PublicDomain,
    r2AccessKeyId: runtimeConfig.r2AccessKeyId,
    r2SecretAccessKey: runtimeConfig.r2SecretAccessKey,
  };
  Object.assign(runtimeConfig, {
    r2AccountId: 'account',
    r2BucketName: 'bucket',
    r2PublicDomain: '',
    r2AccessKeyId: 'access',
    r2SecretAccessKey: 'secret',
  });
  try {
    const upload = generateR2PrivateUploadUrl('bukti lomba.png', 'contest-evidence/entry-1', 'image/png');
    const access = generateR2PrivateAccessUrl(upload.key);
    assert.match(upload.uploadUrl, /X-Amz-Signature=[a-f0-9]{64}/);
    assert.match(upload.uploadUrl, /X-Amz-SignedHeaders=content-type%3Bhost/);
    assert.match(access.accessUrl, /X-Amz-Signature=[a-f0-9]{64}/);
    assert.equal(upload.expiresInSeconds, 900);
    assert.doesNotMatch(upload.uploadUrl, /media\.example/);
  } finally {
    Object.assign(runtimeConfig, original);
  }
});

test('R2 image upload verification requires exact stored metadata and a matching PNG signature', async () => {
  const original = {
    r2AccountId: runtimeConfig.r2AccountId,
    r2BucketName: runtimeConfig.r2BucketName,
    r2PublicDomain: runtimeConfig.r2PublicDomain,
    r2AccessKeyId: runtimeConfig.r2AccessKeyId,
    r2SecretAccessKey: runtimeConfig.r2SecretAccessKey,
  };
  const originalFetch = globalThis.fetch;
  Object.assign(runtimeConfig, {
    r2AccountId: 'account',
    r2BucketName: 'bucket',
    r2PublicDomain: '',
    r2AccessKeyId: 'access',
    r2SecretAccessKey: 'secret',
  });
  let contentLength = '100';
  let imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'HEAD') {
      return new Response(null, { status: 200, headers: { 'content-type': 'image/png', 'content-length': contentLength } });
    }
    assert.equal(init?.headers && new Headers(init.headers).get('range'), 'bytes=0-15');
    return new Response(imageBytes, { status: 206, headers: { 'content-type': 'image/png' } });
  }) as typeof fetch;

  try {
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', 100), true);
    contentLength = '99';
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', 100), false);
    contentLength = '100';
    imageBytes = Buffer.from('not an image');
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', 100), false);
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(runtimeConfig, original);
  }
});

test('R2 presigned URL encodes object segments and uses a real SigV4 signature', () => {
  const original = {
    r2AccountId: runtimeConfig.r2AccountId,
    r2BucketName: runtimeConfig.r2BucketName,
    r2PublicDomain: runtimeConfig.r2PublicDomain,
    r2AccessKeyId: runtimeConfig.r2AccessKeyId,
    r2SecretAccessKey: runtimeConfig.r2SecretAccessKey,
  };
  Object.assign(runtimeConfig, {
    r2AccountId: 'account',
    r2BucketName: 'bucket',
    r2PublicDomain: 'https://media.example.test',
    r2AccessKeyId: 'access',
    r2SecretAccessKey: 'secret',
  });
  try {
    const result = generateR2PresignedUrl('../portrait image.png', 'students/photos');
    assert.match(result.uploadUrl, /^https:\/\/account\.r2\.cloudflarestorage\.com\/bucket\/students\/photos\//);
    assert.match(result.uploadUrl, /X-Amz-Signature=[a-f0-9]{64}/);
    assert.doesNotMatch(result.uploadUrl, /mock_presigned/);
    assert.match(result.publicUrl, /^https:\/\/media\.example\.test\/students\/photos\//);
  } finally {
    Object.assign(runtimeConfig, original);
  }
});
