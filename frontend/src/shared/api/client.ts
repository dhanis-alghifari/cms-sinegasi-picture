// Shared HTTP client — Constitution: all requests through service layer, never from UI directly
// PRD: every mutating request must send x-change-reason header

import { env } from '@/shared/config/env';
import {
  ApiError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors';

const TOKEN_KEY = 'sinegasi_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface RequestOptions extends RequestInit {
  /** Required by PRD for all mutating requests (POST/PUT/PATCH/DELETE) */
  changeReason?: string;
  idempotencyKey?: string;
}

export type ResponseDecoder<T> = (payload: unknown) => T;

async function fetchResponse(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  const { changeReason, idempotencyKey, headers: customHeaders, ...rest } = options;

  const token = getToken();

  const headers = new Headers(customHeaders);
  if (typeof rest.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', 'Bearer ' + token);
  }

  // PRD: Zero Silent Edits — every mutation must include x-change-reason
  if (changeReason) {
    headers.set('x-change-reason', changeReason);
  }
  if (idempotencyKey) {
    headers.set('x-idempotency-key', idempotencyKey);
  }

  const response = await fetch(`${env.apiUrl}${endpoint}`, {
    ...rest,
    // Authenticated application data must never be served from the browser HTTP cache.
    // React Query owns the client cache and mutations explicitly invalidate it.
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    let errorBody: { message?: string; errors?: Record<string, string[]>; error_code?: string; error?: string; request_id?: string; details?: unknown } = {};

    try {
      errorBody = await response.json();
    } catch {
      // Response body not JSON — use status text
    }

    const message = errorBody.message ?? response.statusText;
    const errorCode = errorBody.error_code ?? errorBody.error;

    switch (response.status) {
      case 401:
        throw new UnauthorizedError(message, errorCode, errorBody.request_id);
      case 403:
        throw new ForbiddenError(message, errorCode, errorBody.request_id);
      case 404:
        throw new NotFoundError(message, errorCode, errorBody.request_id);
      case 422:
        throw new ValidationError(message, errorBody.errors, errorCode, errorBody.request_id);
      default:
        throw new ApiError(message, response.status, errorBody.errors, errorCode, errorBody.request_id, errorBody.details);
    }
  }

  return response;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetchResponse(endpoint, options);

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text || text.trim().length === 0) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('Respon dari server tidak valid (bukan JSON)', response.status);
  }
}

export type AuthenticatedImageResult =
  | { kind: 'blob'; blob: Blob }
  | { kind: 'remote'; url: string }
  | null;

async function requestImage(endpoint: string, options: RequestOptions = {}): Promise<AuthenticatedImageResult> {
  const response = await fetchResponse(endpoint, { method: 'GET', ...options });
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType && ['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    return { kind: 'blob', blob: await response.blob() };
  }

  const payload: unknown = await response.json().catch(() => null);
  if (payload && typeof payload === 'object' && 'url' in payload && typeof payload.url === 'string') {
    try {
      const url = new URL(payload.url);
      if (payload.url.length <= 2048 && (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
        return { kind: 'remote', url: url.toString() };
      }
    } catch {
      // Report a typed response error below instead of leaking URL parser details.
    }
  }
  throw new ApiError('Respon gambar dari server tidak valid', response.status);
}

async function requestParsed<T>(
  endpoint: string,
  decoder: ResponseDecoder<T>,
  options: RequestOptions = {},
): Promise<T> {
  const payload = await request<unknown>(endpoint, options);
  return decoder(payload);
}

export const apiClient = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { method: 'GET', ...options });
  },

  getImage(endpoint: string, options?: RequestOptions): Promise<AuthenticatedImageResult> {
    return requestImage(endpoint, options);
  },

  getParsed<T>(endpoint: string, decoder: ResponseDecoder<T>, options?: RequestOptions): Promise<T> {
    return requestParsed(endpoint, decoder, { method: 'GET', ...options });
  },

  postParsed<T>(endpoint: string, body: unknown, decoder: ResponseDecoder<T>, options?: RequestOptions): Promise<T> {
    return requestParsed(endpoint, decoder, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    });
  },

  putParsed<T>(endpoint: string, body: unknown, decoder: ResponseDecoder<T>, options?: RequestOptions): Promise<T> {
    return requestParsed(endpoint, decoder, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    });
  },

  patchParsed<T>(endpoint: string, body: unknown, decoder: ResponseDecoder<T>, options?: RequestOptions): Promise<T> {
    return requestParsed(endpoint, decoder, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    });
  },

  deleteParsed<T>(endpoint: string, decoder: ResponseDecoder<T>, options?: RequestOptions): Promise<T> {
    return requestParsed(endpoint, decoder, { method: 'DELETE', ...options });
  },

  post<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    });
  },

  put<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    });
  },

  patch<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    });
  },

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE', ...options });
  },
};
