/**
 * Minimal error shape returned by Supabase/PostgREST and our in-memory adapters.
 * Keeping this boundary type local prevents database SDK types from leaking into
 * services and makes error handling safe when a non-database adapter is used.
 */
export type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export type DatabaseRow = Record<string, unknown>;

export function asDatabaseError(error: unknown): DatabaseError | null {
  if (!error || typeof error !== 'object') return null;
  const value = error as Record<string, unknown>;
  return {
    ...(typeof value.code === 'string' ? { code: value.code } : {}),
    ...(typeof value.message === 'string' ? { message: value.message } : {}),
    ...(typeof value.details === 'string' ? { details: value.details } : {}),
    ...(typeof value.hint === 'string' ? { hint: value.hint } : {}),
  };
}

export function databaseErrorCode(error: unknown): string | undefined {
  return asDatabaseError(error)?.code;
}

export function databaseErrorMessage(error: unknown): string | undefined {
  return asDatabaseError(error)?.message;
}
