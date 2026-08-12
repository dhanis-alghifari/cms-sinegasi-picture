const MAX_COMPRESSED_IMAGE_BYTES = 600 * 1024;
const MAX_IMAGE_DIMENSION = 1200;

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

export async function compressImageFile(file: File): Promise<string> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser tidak mendukung pemrosesan foto.');

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.82;
  let blob: Blob | null = null;
  while (quality >= 0.45) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    if (blob && blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break;
    quality -= 0.1;
  }

  if (!blob || blob.size > MAX_COMPRESSED_IMAGE_BYTES) {
    throw new Error('Foto terlalu besar setelah dikompres. Pilih foto lain.');
  }

  return readBlobAsDataUrl(blob);
}
