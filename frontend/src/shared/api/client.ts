// src/shared/api/client.ts
// Shared HTTP client — Constitution: all requests through service layer, never from UI directly
// PRD: every mutating request must send x-change-reason header

import { env } from '@/app/config/env';
import {
  ApiError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors';

// Token storage key
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

// Core fetch wrapper
interface RequestOptions extends RequestInit {
  /** Required by PRD for all mutating requests (POST/PUT/PATCH/DELETE) */
  changeReason?: string;
  idempotencyKey?: string;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { changeReason, idempotencyKey, headers: customHeaders, ...rest } = options;

  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // PRD: Zero Silent Edits — every mutation must include x-change-reason
  if (changeReason) {
    headers['x-change-reason'] = changeReason;
  }
  if (idempotencyKey) {
    headers['x-idempotency-key'] = idempotencyKey;
  }

  const response = await fetch(`${env.apiUrl}${endpoint}`, {
    ...rest,
    // Authenticated application data must never be served from the browser HTTP cache.
    // React Query owns the client cache and mutations explicitly invalidate it.
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    let errorBody: { message?: string; errors?: Record<string, string[]>; error_code?: string; error?: string; request_id?: string } = {};

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
        throw new ApiError(message, response.status, errorBody.errors, errorCode, errorBody.request_id);
    }
  }

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

// HTTP method helpers
export const apiClient = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { method: 'GET', ...options });
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
