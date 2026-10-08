import type { FastifyReply } from 'fastify';
import { validateImageReference } from '../uploads/imageReference.js';

type ImagePayload =
  | { kind: 'inline'; contentType: string; body: Buffer }
  | { kind: 'remote'; url: string }
  | null;

function imagePayload(reference: string | null, maxDecodedBytes: number): ImagePayload {
  if (!reference) return null;
  const normalized = reference.trim();
  const validation = validateImageReference(reference, {
    maxDecodedBytes,
    maxLength: Math.ceil(maxDecodedBytes / 3) * 4 + 64,
  });
  if (!validation.valid) return null;

  if (validation.kind === 'remote') {
    if (normalized.length > 2048) return null;
    return { kind: 'remote', url: new URL(normalized).toString() };
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(normalized);
  if (!match) return null;
  return {
    kind: 'inline',
    contentType: match[1].toLowerCase(),
    body: Buffer.from(match[2], 'base64'),
  };
}

export function sendPrivateImageReference(
  reply: FastifyReply,
  reference: string | null,
  maxDecodedBytes: number,
): FastifyReply {
  const headers = reply
    .header('Cache-Control', 'private, no-store')
    .header('X-Content-Type-Options', 'nosniff');
  const payload = imagePayload(reference, maxDecodedBytes);
  if (!payload) return headers.status(204).send();
  if (payload.kind === 'remote') return headers.send({ url: payload.url });
  return headers
    .type(payload.contentType)
    .header('Content-Disposition', 'inline')
    .send(payload.body);
}
