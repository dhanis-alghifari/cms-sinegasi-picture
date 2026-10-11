import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeConfig } from '../config/env.js';
import {
  generateR2PrivateAccessUrl,
  generateR2PrivateUploadUrl,
  generateR2PrivateUploadUrlForKey,
  generateR2PresignedUrl,
  inspectCloudflareR2Object,
  uploadToCloudflareR2,
  verifyCloudflareR2ImageUpload,
} from './cloudflareR2Service.js';

const PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');

async function withPrivateR2(run: () => void | Promise<void>): Promise<void> {
  const original = {
    r2AccountId: runtimeConfig.r2AccountId,
    r2BucketName: runtimeConfig.r2BucketName,
    r2PublicDomain: runtimeConfig.r2PublicDomain,
    r2AccessKeyId: runtimeConfig.r2AccessKeyId,
    r2SecretAccessKey: runtimeConfig.r2SecretAccessKey,
  };
  const originalFetch = globalThis.fetch;
  Object.assign(runtimeConfig, {
    r2AccountId: 'account', r2BucketName: 'bucket', r2PublicDomain: '',
    r2AccessKeyId: 'access', r2SecretAccessKey: 'secret',
  });
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(runtimeConfig, original);
  }
}

function imageResponse(bytes: ArrayLike<number> = PNG_BYTES, contentType = 'image/png'): Response {
  return new Response(new Uint8Array(bytes), {
    headers: { 'content-type': contentType, 'content-length': String(bytes.length) },
  });
}

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
    assert.match(upload.key, /^staging-v2\/contest-evidence\/entry-1\//);
    assert.match(upload.uploadUrl, /\/bucket\/staging-v2\//);
    assert.match(access.accessUrl, /\/bucket\/validated-v2\//);
    assert.equal(upload.expiresInSeconds, 300);
    assert.equal(access.expiresInSeconds, 900);
    assert.equal(new URL(upload.uploadUrl).searchParams.get('X-Amz-Expires'), '300');
    assert.doesNotMatch(upload.uploadUrl, /media\.example/);
  } finally {
    Object.assign(runtimeConfig, original);
  }
});

test('legacy image verification validates metadata and exact complete bytes from the same GET', async () => {
  await withPrivateR2(async () => {
    let response = imageResponse();
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(init?.method, 'GET');
      assert.equal(new Headers(init?.headers).has('range'), false);
      assert.equal(init?.redirect, 'error');
      assert.ok(init?.signal instanceof AbortSignal);
      return response;
    }) as typeof fetch;
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', PNG_BYTES.length), true);
    response = imageResponse(PNG_BYTES, 'image/jpeg');
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', PNG_BYTES.length), false);
    response = imageResponse();
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', PNG_BYTES.length + 1), false);
    const notImage = Buffer.from('not an image');
    response = imageResponse(notImage);
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', notImage.length), false);
  });
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

test('new private uploads promote the exact validated snapshot and never issue browser writes to the final key', async () => {
  await withPrivateR2(async () => {
    const stagingKey = 'staging-v2/contest-evidence/entry-1/test.png';
    const finalPath = '/bucket/validated-v2/contest-evidence/entry-1/test.png';
    let finalBytes: Buffer | undefined;
    let stagingBytes = Buffer.from(PNG_BYTES);
    let promotions = 0;
    const requests: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      requests.push(`${init?.method} ${url.pathname}`);
      assert.equal(init?.redirect, 'error');
      assert.ok(init?.signal instanceof AbortSignal);
      if (init?.method === 'GET') {
        if (url.pathname === finalPath) return finalBytes ? imageResponse(finalBytes) : new Response(null, { status: 404 });
        assert.equal(url.pathname, `/bucket/${stagingKey}`);
        const snapshot = imageResponse(stagingBytes);
        stagingBytes = Buffer.from('overwritten after the GET started');
        return snapshot;
      }
      assert.equal(init?.method, 'PUT');
      assert.equal(url.pathname, finalPath);
      const headers = new Headers(init.headers);
      assert.equal(headers.get('if-none-match'), '*');
      assert.equal(headers.get('content-type'), 'image/png');
      assert.ok(headers.get('content-md5'));
      assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'content-md5;content-type;host;if-none-match');
      assert.deepEqual(init.body, PNG_BYTES);
      finalBytes = Buffer.from(init.body as Buffer);
      promotions += 1;
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    assert.equal(await verifyCloudflareR2ImageUpload(stagingKey, 'image/png', PNG_BYTES.length), true);
    assert.deepEqual(finalBytes, PNG_BYTES);
    assert.equal(await verifyCloudflareR2ImageUpload(stagingKey, 'image/png', PNG_BYTES.length), true);
    assert.equal(promotions, 1);
    assert.deepEqual(requests, [
      `GET ${finalPath}`,
      `GET /bucket/${stagingKey}`,
      `PUT ${finalPath}`,
      `GET ${finalPath}`,
    ]);
    const access = generateR2PrivateAccessUrl(stagingKey);
    assert.equal(new URL(access.accessUrl).pathname, finalPath);
    assert.throws(() => generateR2PrivateUploadUrlForKey(finalPath.slice('/bucket/'.length), 'image/png'), /R2_VALIDATED_OBJECT_READ_ONLY/);
    assert.match(generateR2PrivateUploadUrlForKey(stagingKey, 'image/png').uploadUrl, /\/staging-v2\//);
  });
});

test('concurrent promotion retries use an already finalized snapshot without overwriting it', async () => {
  await withPrivateR2(async () => {
    let finalReads = 0;
    let puts = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method === 'PUT') {
        puts += 1;
        assert.equal(new Headers(init.headers).get('if-none-match'), '*');
        return new Response(null, { status: 412 });
      }
      if (url.pathname.includes('/validated-v2/')) {
        finalReads += 1;
        return finalReads === 1 ? new Response(null, { status: 404 }) : imageResponse();
      }
      return imageResponse();
    }) as typeof fetch;
    assert.equal(await verifyCloudflareR2ImageUpload('staging-v2/evidence/test.png', 'image/png', PNG_BYTES.length), true);
    assert.equal(puts, 1);
    assert.equal(finalReads, 2);
  });
});

test('an existing final object with incorrect metadata is not overwritten or accepted', async () => {
  await withPrivateR2(async () => {
    let requests = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests += 1;
      assert.match(String(input), /\/validated-v2\//);
      assert.equal(init?.method, 'GET');
      return imageResponse(PNG_BYTES, 'image/jpeg');
    }) as typeof fetch;
    assert.equal(await verifyCloudflareR2ImageUpload('staging-v2/evidence/test.png', 'image/png', PNG_BYTES.length), false);
    assert.equal(requests, 1);
  });
});

test('verification rejects missing metadata, partial responses, empty objects and unsupported encodings', async () => {
  await withPrivateR2(async () => {
    const responses = [
      new Response(new Uint8Array(PNG_BYTES), { headers: { 'content-type': 'image/png' } }),
      new Response(new Uint8Array(PNG_BYTES), { headers: { 'content-length': String(PNG_BYTES.length) } }),
      new Response(new Uint8Array(PNG_BYTES), { status: 206, headers: { 'content-type': 'image/png', 'content-length': String(PNG_BYTES.length) } }),
      new Response(null, { headers: { 'content-type': 'image/png', 'content-length': '0' } }),
      new Response(new Uint8Array(PNG_BYTES), { headers: { 'content-type': 'image/png', 'content-length': String(PNG_BYTES.length), 'content-encoding': 'gzip' } }),
    ];
    for (const response of responses) {
      globalThis.fetch = (async () => response) as typeof fetch;
      assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', PNG_BYTES.length), false);
    }
  });
});

test('bounded streaming verification rejects truncated and overflowing bodies despite declared headers', async () => {
  await withPrivateR2(async () => {
    let cancelled = false;
    const overflow = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(PNG_BYTES));
        controller.enqueue(new Uint8Array([0]));
      },
      cancel() { cancelled = true; },
    });
    globalThis.fetch = (async () => new Response(overflow, {
      headers: { 'content-type': 'image/png', 'content-length': String(PNG_BYTES.length) },
    })) as typeof fetch;
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', PNG_BYTES.length), false);
    assert.equal(cancelled, true);

    globalThis.fetch = (async () => new Response(new Uint8Array(PNG_BYTES.subarray(0, PNG_BYTES.length - 1)), {
      headers: { 'content-type': 'image/png', 'content-length': String(PNG_BYTES.length) },
    })) as typeof fetch;
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', PNG_BYTES.length), false);
  });
});

test('invalid caller limits reject before storage requests and missing HEAD length is not zero', async () => {
  await withPrivateR2(async () => {
    globalThis.fetch = (async () => { assert.fail('invalid inputs must not reach storage'); }) as typeof fetch;
    for (const length of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 5 * 1024 * 1024 + 1]) {
      assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.png', 'image/png', length), false);
    }
    assert.equal(await verifyCloudflareR2ImageUpload('evidence/test.svg', 'image/svg+xml', PNG_BYTES.length), false);
    globalThis.fetch = (async () => new Response(null, { headers: { 'content-type': 'image/png' } })) as typeof fetch;
    assert.equal((await inspectCloudflareR2Object('evidence/test.png')).contentLength, undefined);
  });
});

test('legacy attached evidence keeps its original read key and pending retry compatibility', async () => {
  await withPrivateR2(() => {
    assert.equal(new URL(generateR2PrivateAccessUrl('contest-evidence/entry-1/test.png').accessUrl).pathname, '/bucket/contest-evidence/entry-1/test.png');
    assert.equal(new URL(generateR2PrivateUploadUrlForKey('contest-evidence/entry-1/test.png', 'image/png').uploadUrl).pathname, '/bucket/contest-evidence/entry-1/test.png');
    assert.throws(() => generateR2PrivateUploadUrlForKey('staging-v2/../test.png', 'image/png'), /R2_INVALID_KEY/);
  });
});
