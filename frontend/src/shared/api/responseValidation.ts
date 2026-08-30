import { z } from 'zod';
import { ApiError } from './errors';
import type { ResponseDecoder } from './client';
import type { PaginatedResponse } from '@/shared/types/common';

/**
 * Parse data received from an HTTP boundary before it enters application code.
 * The server response is untrusted even when its TypeScript type looks known.
 */
export function decodeWithSchema<T>(schema: z.ZodType<T>): ResponseDecoder<T> {
  return (payload: unknown): T => {
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
  }).passthrough();
}

export function successPaginationSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().positive(),
  }).passthrough();
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
