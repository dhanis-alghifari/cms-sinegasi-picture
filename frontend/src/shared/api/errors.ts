// Constitution: UI determines how errors are displayed; service layer throws typed errors

export class ApiError extends Error {
  public override readonly message: string;
  public readonly statusCode: number;
  public readonly errors?: Record<string, string[]>;
  public readonly errorCode?: string;
  public readonly requestId?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, errors?: Record<string, string[]>, errorCode?: string, requestId?: string, details?: unknown) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.errors = errors;
    this.errorCode = errorCode;
    this.requestId = requestId;
    this.details = details;
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Sesi Anda telah berakhir. Silakan login kembali.', errorCode?: string, requestId?: string) {
    super(message, 401, undefined, errorCode, requestId);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Anda tidak memiliki akses untuk melakukan tindakan ini.', errorCode?: string, requestId?: string) {
    super(message, 403, undefined, errorCode, requestId);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Data tidak ditemukan.', errorCode?: string, requestId?: string) {
    super(message, 404, undefined, errorCode, requestId);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, errors?: Record<string, string[]>, errorCode?: string, requestId?: string) {
    super(message, 422, errors, errorCode, requestId);
    this.name = 'ValidationError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Terjadi kesalahan. Silakan coba lagi.';
}
