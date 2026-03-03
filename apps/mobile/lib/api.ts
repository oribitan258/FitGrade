/**
 * Typed fetch wrapper for all API calls from the mobile app.
 *
 * - Automatically attaches the JWT Authorization header from MMKV storage.
 * - Throws an ApiError (Error subclass) on non-2xx responses so React Query
 *   and error boundaries receive a proper Error instance with a stack trace.
 * - On 401: clears the stored token (auth module handles redirect to /login).
 *
 * Storage integration and full error handling added in auth phase.
 * This stub establishes the module so imports resolve during scaffolding.
 */

import { ApiError } from '@fitgrade/types';

export type { ApiError };

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';

/** Shape of the raw JSON error body returned by the NestJS API. */
interface RawErrorBody {
  statusCode?: number;
  message?: string;
  error?: string;
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  // TODO (auth phase): read JWT from MMKV storage and attach as Bearer token
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as RawErrorBody;
    throw new ApiError(
      response.status,
      body.message ?? 'שגיאה לא צפויה',
      body.error ?? 'Unknown Error',
    );
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> =>
    request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string): Promise<T> =>
    request<T>(path, { method: 'DELETE' }),
};
