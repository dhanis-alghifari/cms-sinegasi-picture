export type ImageReferenceValidation =
  | { valid: true; kind: 'inline' | 'remote' }
  | { valid: false; reason: 'invalid' | 'too_large' };

export interface ImageReferenceLimits {
  maxDecodedBytes: number;
  maxLength?: number;
  /** Metadata links only; never use this option for uploaded private images. */
  allowRemote?: boolean;
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** A signature check is not image decoding, malware scanning, or moderation. */
export function hasSupportedImageSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return bytes.length >= pngSignature.length && pngSignature.every((byte, index) => bytes[index] === byte);
  }
  return contentType === 'image/webp' && bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

/** Validate references without fetching arbitrary URLs or allocating unbounded decoded buffers. */
export function validateImageReference(value: string, limits: ImageReferenceLimits): ImageReferenceValidation {
  const normalized = value.trim();
  if (limits.maxLength !== undefined && normalized.length > limits.maxLength) {
    return { valid: false, reason: 'too_large' };
  }
  if (!normalized || /[\u0000-\u001f\u007f]/.test(value)) return { valid: false, reason: 'invalid' };

  if (/^data:/i.test(normalized)) {
    const prefix = /^data:(image\/(?:jpeg|png|webp));base64,/i.exec(normalized);
    if (!prefix || !Number.isSafeInteger(limits.maxDecodedBytes) || limits.maxDecodedBytes <= 0) {
      return { valid: false, reason: 'invalid' };
    }
    const encoded = normalized.slice(prefix[0].length);
    if (encoded.length > Math.ceil(limits.maxDecodedBytes / 3) * 4) return { valid: false, reason: 'too_large' };
    if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      return { valid: false, reason: 'invalid' };
    }
    let padding = 0;
    if (encoded.endsWith('==')) padding = 2;
    else if (encoded.endsWith('=')) padding = 1;
    const decodedLength = encoded.length / 4 * 3 - padding;
    if (decodedLength > limits.maxDecodedBytes) return { valid: false, reason: 'too_large' };
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length !== decodedLength || bytes.toString('base64') !== encoded
        || !hasSupportedImageSignature(bytes, prefix[1].toLowerCase())) {
      return { valid: false, reason: 'invalid' };
    }
    return { valid: true, kind: 'inline' };
  }

  if (!limits.allowRemote || !/^https?:\/\//i.test(normalized) || /[\s\\]/.test(normalized)) return { valid: false, reason: 'invalid' };
  try {
    const url = new URL(normalized);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname || url.username || url.password) {
      return { valid: false, reason: 'invalid' };
    }
    return { valid: true, kind: 'remote' };
  } catch {
    return { valid: false, reason: 'invalid' };
  }
}
