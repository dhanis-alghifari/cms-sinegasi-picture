import { z } from 'zod';
import { ApiError } from './errors';
import type { ResponseDecoder } from './client';
import type { PaginatedResponse } from '@/shared/types/common';

// Bound work before Zod validates untrusted API data. Its size checks cannot
// protect schemas with no collection limit, even on patched versions.
const MAX_RESPONSE_NODES = 100_000;
const MAX_COLLECTION_ITEMS = 10_000;

function assertResponseWithinLimits(payload: unknown): void {
  const pending: unknown[] = [payload];
  let remaining = MAX_RESPONSE_NODES;
  let oversized = false;

  while (pending.length > 0) {
    const value = pending.pop();
    remaining -= 1;
    if (remaining < 0) { oversized = true; break; }
    if (value === null || typeof value !== 'object') continue;

    const children = Array.isArray(value) ? value : Object.values(value);
    if (children.length > MAX_COLLECTION_ITEMS || children.length > remaining - pending.length) {
      oversized = true;
      break;
    }
    pending.push(...children);
  }
  if (oversized) throw new ApiError('Respon server terlalu besar untuk diproses.', 502, undefined, 'API_RESPONSE_TOO_LARGE');
}

/**
 * Parse data received from an HTTP boundary before it enters application code.
 * The server response is untrusted even when its TypeScript type looks known.
 */
export function decodeWithSchema<T>(schema: z.ZodType<T>): ResponseDecoder<T> {
  return (payload: unknown): T => {
    assertResponseWithinLimits(payload);
    const parsed = schema.safeParse(payload);
    if (parsed.success) return parsed.data;

    throw new ApiError(
      'Respon server tidak sesuai kontrak aplikasi.',
      502,
      undefined,
      'API_RESPONSE_INVALID',
      undefined,
      parsed.error.issues,
    );
  };
}

export function successDataEnvelopeSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  }).loose();
}

export function successPaginationSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().positive(),
  }).loose();
}

export function decodeDataEnvelope<T>(dataSchema: z.ZodType<T>): ResponseDecoder<T> {
  const decodeEnvelope = decodeWithSchema(successDataEnvelopeSchema(dataSchema));
  return (payload: unknown): T => decodeEnvelope(payload).data;
}

export function decodePaginatedResponse<T>(itemSchema: z.ZodType<T>): ResponseDecoder<PaginatedResponse<T>> {
  const schema = successPaginationSchema(itemSchema).transform(({ data, total, page, pageSize, totalPages }) => ({
    data,
    total,
    page,
    pageSize,
    totalPages,
  }));
  return decodeWithSchema(schema);
}

const voidResponseSchema = z.union([
  z.undefined(),
  z.object({ success: z.literal(true) }).loose(),
]);

/** Decode mutations whose useful result is only success/failure. */
export const decodeVoidResponse: ResponseDecoder<void> = (payload) => {
  decodeWithSchema(voidResponseSchema)(payload);
};
