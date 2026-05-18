/**
 * Typed fetch wrapper for all API calls from the mobile app.
 *
 * - Automatically attaches the JWT Authorization header from MMKV storage.
 * - Throws an ApiError (Error subclass) on non-2xx responses so React Query
 *   and error boundaries receive a proper Error instance with a stack trace.
 * - On 401: clears the stored token (auth module handles redirect to /login).
 *
 * SECURITY NOTE — Certificate pinning (P1):
 * This client uses the OS default TLS validation. Certificate pinning should be
 * added before production release to prevent MITM attacks on school WiFi networks.
 * Implementation steps:
 *   1. Install: pnpm --filter=mobile add react-native-ssl-pinning
 *   2. Replace fetch() below with fetch from react-native-ssl-pinning
 *   3. Supply the SHA-256 fingerprint(s) of the production API certificate:
 *      sslPinning: { certs: ['<SHA256_FINGERPRINT_WITHOUT_COLONS>'] }
 *   4. Add the same fingerprint to ios/App/Resources/Info.plist (NSPinnedDomains)
 *      and android/app/src/main/res/xml/network_security_config.xml
 */

import { ApiError } from '@fitgrade/types';
import { getAccessToken, clearAccessToken } from './storage';

export type { ApiError };

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';

/** Shape of the raw JSON error body returned by the NestJS API. */
interface RawErrorBody {
  statusCode?: number;
  message?: string;
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
    ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
    }
    if (response.status === 410) {
      // Server signals this app version is no longer supported.
      // Throw a typed error so callers can show an "update required" prompt.
      throw new ApiError(410, 'גרסת האפליקציה אינה נתמכת עוד — יש לעדכן מ-App Store', 'App Version Deprecated');
    }
    const body = (await response.json().catch(() => ({}))) as RawErrorBody;
    throw new ApiError(
      response.status,
      body.message ?? 'שגיאה לא צפויה',
      body.error ?? 'Unknown Error',
    );
  }

  if (response.status === 204) return undefined as unknown as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> =>
    request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(path: string): Promise<T> =>
    request<T>(path, { method: 'DELETE' }),
};
