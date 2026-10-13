import { ApiError } from './errors';
import { isPrivateImageEndpoint } from './privateMedia';

export type PrivateImageResult = { kind: 'blob'; blob: Blob } | null;
type ImageTransport = (endpoint: string, options: RequestInit) => Promise<Response>;

/** Destination validation happens before attaching credentials in the transport. */
export async function requestPrivateImage(endpoint: string, transport: ImageTransport, options: RequestInit = {}): Promise<PrivateImageResult> {
  if (!isPrivateImageEndpoint(endpoint)) throw new ApiError('Endpoint gambar privat tidak valid', 400);
  const response = await transport(endpoint, { ...options, method: 'GET', redirect: 'error' });
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  const maxBytes = 5 * 1024 * 1024;
  if (response.status !== 200 || response.redirected || !response.body || !contentType || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    await response.body?.cancel();
    throw new ApiError('Respon gambar dari server tidak valid', response.status);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ApiError('Gambar terlalu besar', 502); }
      chunks.push(new Uint8Array(value));
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new ApiError('Respon gambar kosong', 502);
  return { kind: 'blob', blob: new Blob(chunks, { type: contentType }) };
}
