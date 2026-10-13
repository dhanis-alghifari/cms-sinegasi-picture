import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_EQUIPMENT_PHOTO_BYTES, validateEquipmentPhotos, validatePhotoUrl } from './equipment.helpers.js';

const pngPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';

test('equipment photos accept canonical raster data and retain the three-photo rule', () => {
  assert.equal(validatePhotoUrl(pngPhoto), true);
  assert.equal(validateEquipmentPhotos([pngPhoto, pngPhoto]).photos, undefined);
  assert.deepEqual(validateEquipmentPhotos([pngPhoto, pngPhoto, pngPhoto]).photos, [pngPhoto, pngPhoto, pngPhoto]);
  assert.equal(validateEquipmentPhotos([pngPhoto, 'https://example.test/front.jpg', 'http://example.test/back.jpg']).photos, undefined);
});

test('equipment photos reject unsupported image data, forged signatures and credential-bearing links', () => {
  for (const photo of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/png;base64,AAAA', 'https://user:password@example.test/front.jpg', 'https://example.test/front.jpg\n']) {
    assert.equal(validatePhotoUrl(photo), false);
    assert.equal(validateEquipmentPhotos([photo, pngPhoto, pngPhoto]).photos, undefined);
  }
});

test('equipment photos keep their existing decoded 600 KiB bound and size-specific error', () => {
  // This fixture tests only the byte bound; it is deliberately not an encoded full image.
  const bytes = Buffer.alloc(MAX_EQUIPMENT_PHOTO_BYTES + 1);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const largePhoto = `data:image/png;base64,${bytes.toString('base64')}`;
  assert.equal(validatePhotoUrl(largePhoto), false);
  assert.equal(validateEquipmentPhotos([largePhoto, pngPhoto, pngPhoto]).message, 'Ukuran setiap foto maksimal 600 KB.');
});
