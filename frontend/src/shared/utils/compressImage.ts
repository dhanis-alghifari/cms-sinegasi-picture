export const MAX_COMPRESSED_IMAGE_BYTES = 600 * 1024;
export const MAX_IMAGE_DIMENSION = 1600;
const MIN_JPEG_QUALITY = 0.5;
const MAX_JPEG_QUALITY = 0.88;

export const MAX_SOURCE_IMAGE_BYTES = 5 * 1024 * 1024;

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Foto tidak dapat diproses.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Foto tidak dapat dibaca.'));
    };
    image.src = objectUrl;
  });
}

export async function compressImageFileToBlob(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser tidak mendukung pemrosesan foto.');

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let low = MIN_JPEG_QUALITY;
  let high = MAX_JPEG_QUALITY;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const quality = (low + high) / 2;
    const candidate = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    if (!candidate) continue;
    if (candidate.size <= MAX_COMPRESSED_IMAGE_BYTES) {
      blob = candidate;
      low = quality;
    } else {
      high = quality;
    }
  }

  if (!blob || blob.size > MAX_COMPRESSED_IMAGE_BYTES) {
    throw new Error('Foto terlalu besar untuk diproses. Pilih foto lain.');
  }

  return blob;
}

export async function compressImageFileToFile(file: File): Promise<File> {
  const blob = await compressImageFileToBlob(file);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export async function compressImageFile(file: File): Promise<string> {
  const blob = await compressImageFileToBlob(file);
  return readBlobAsDataUrl(blob);
}
