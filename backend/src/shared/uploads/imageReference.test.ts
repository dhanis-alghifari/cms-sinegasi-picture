import assert from 'node:assert/strict';
import test from 'node:test';
import { hasSupportedImageSignature, validateImageReference } from './imageReference.js';

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
const pngReference = `data:image/png;base64,${pngBase64}`;
const limits = { maxDecodedBytes: 600 * 1024 };

test('image references accept canonical PNG data and parsed HTTP(S) links without fetching', () => {
  assert.deepEqual(validateImageReference(pngReference, limits), { valid: true, kind: 'inline' });
  for (const reference of ['https://example.test/photo.png', 'http://example.test/photo.jpg', ' https://example.test/photo.webp ']) {
    assert.deepEqual(validateImageReference(reference, limits), { valid: true, kind: 'remote' });
  }
});

test('image references reject SVG, HTML, unsupported MIME types and forged raster metadata', () => {
  for (const reference of [
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:text/html;base64,PGI+aGk8L2I+',
    'data:image/gif;base64,R0lGODlh',
    `data:image/jpeg;base64,${pngBase64}`,
    'data:image/png;base64,AAAA',
    'data:image/png;name=test;base64,AAAA',
  ]) assert.equal(validateImageReference(reference, limits).valid, false);
});

test('image references reject noncanonical base64 instead of trusting permissive Buffer decoding', () => {
  for (const reference of [
    'data:image/jpeg;base64,/9j/AB==', // Non-zero padding bits decode to the same bytes as AA==.
    `data:image/png;base64,${pngBase64.replace(/=+$/, '')}`,
    `data:image/png;base64,${pngBase64}=`,
    `data:image/png;base64,${pngBase64.slice(0, 8)} ${pngBase64.slice(8)}`,
    'data:image/jpeg;base64,_9j_AA==',
    'data:image/png;base64,',
  ]) assert.equal(validateImageReference(reference, limits).valid, false);
});

test('image references enforce decoded byte and existing character limits', () => {
  const pngBytes = Buffer.from(pngBase64, 'base64').byteLength;
  assert.equal(validateImageReference(pngReference, { maxDecodedBytes: pngBytes }).valid, true);
  assert.deepEqual(validateImageReference(pngReference, { maxDecodedBytes: pngBytes - 1 }), { valid: false, reason: 'too_large' });
  assert.deepEqual(validateImageReference('https://example.test/photo.png', { ...limits, maxLength: 10 }), { valid: false, reason: 'too_large' });
  assert.equal(validateImageReference(pngReference, { maxDecodedBytes: 0 }).valid, false);
});

test('remote image links reject credentials, control characters and ambiguous protocols', () => {
  for (const reference of [
    'https://user:password@example.test/photo.png',
    'https://user@example.test/photo.png',
    'https://example.test/photo.png\n',
    'https://exa\tmple.test/photo.png',
    'https://example.test/photo.png\u007f',
    'https://example.test/a b.png',
    'https:\\example.test/photo.png',
    'https:example.test/photo.png',
    '//example.test/photo.png',
    'javascript:alert(1)',
    'file:///photo.png',
    '',
  ]) assert.equal(validateImageReference(reference, limits).valid, false);
});

test('signature detection intentionally checks only headers, not decoding or moderation', () => {
  assert.equal(hasSupportedImageSignature(Uint8Array.from([0xff, 0xd8, 0xff]), 'image/jpeg'), true);
  assert.equal(hasSupportedImageSignature(Buffer.from(pngBase64, 'base64'), 'image/png'), true);
  assert.equal(hasSupportedImageSignature(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), 'image/webp'), true);
  assert.equal(hasSupportedImageSignature(Uint8Array.from([0xff, 0xd8]), 'image/jpeg'), false);
});
