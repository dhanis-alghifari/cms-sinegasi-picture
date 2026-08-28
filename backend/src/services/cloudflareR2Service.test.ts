import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeConfig } from '../config/env.js';
import {
  generateR2PrivateAccessUrl,
  generateR2PrivateUploadUrl,
  generateR2PresignedUrl,
  uploadToCloudflareR2,
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
    const upload = generateR2PrivateUploadUrl('bukti lomba.png', 'contest-evidence/entry-1');
    const access = generateR2PrivateAccessUrl(upload.key);
    assert.match(upload.uploadUrl, /X-Amz-Signature=[a-f0-9]{64}/);
    assert.match(access.accessUrl, /X-Amz-Signature=[a-f0-9]{64}/);
    assert.equal(upload.expiresInSeconds, 900);
    assert.doesNotMatch(upload.uploadUrl, /media\.example/);
  } finally {
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
