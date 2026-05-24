/**
 * Typed API client for the FitGrade NestJS backend.
 *
 * Token lifecycle:
 *  - Access token (15 min): stored in an in-memory module variable only.
 *    Never written to localStorage/sessionStorage — XSS cannot steal it.
 *    Lost on page refresh; silentRefresh() restores it from the httpOnly
 *    refresh-token cookie without user interaction.
 *  - Refresh token (7 days): lives in an httpOnly cookie set by the backend.
 *    The browser sends it automatically when credentials:'include' is set.
 */
import { ApiError } from '@fitgrade/types';
import { tryMockResponse } from './tour-fetcher';

const API_BASE: string = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/api`;

// ─── Token management (in-memory — never touches localStorage) ────────────

let _token: string | null = null;

export function getToken(): string | null {
  return _token;
}

export function setToken(token: string): void {
  _token = token;
}

export function clearToken(): void {
  _token = null;
}

/**
 * Attempts a silent token refresh using the httpOnly refresh-token cookie.
 * Returns true and stores the new access token on success; returns false
 * if no valid refresh cookie exists (user must log in again).
 */
export async function silentRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    setToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// ─── Typed fetch wrapper ───────────────────────────────────────────────────

interface RawErrorBody {
  message?: string;
  error?: string;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Tour mock interceptor — short-circuit BEFORE issuing a real fetch when the
  // onboarding tour is active and a handler matches. No-op when the tour is
  // idle (and on the server, where the interceptor singleton is always inactive).
  const mock = tryMockResponse(path, typeof init.method === 'string' ? init.method : 'GET');
  if (mock.matched) {
    return mock.data as T;
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
    ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include', // sends httpOnly refresh-token cookie automatically
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) clearToken();
    const body = (await response.json().catch(() => ({}))) as RawErrorBody;
    throw new ApiError(
      response.status,
      body.message ?? 'שגיאה בשרת',
      body.error ?? 'Error',
    );
  }

  // 204 No Content — no body to parse
  if (response.status === 204) return undefined as unknown as T;

  return (await response.json()) as T;
}

/** Multipart upload — skips Content-Type so browser sets the correct boundary. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) clearToken();
    const body = (await response.json().catch(() => ({}))) as RawErrorBody;
    throw new ApiError(
      response.status,
      body.message ?? 'שגיאה בשרת',
      body.error ?? 'Error',
    );
  }

  if (response.status === 204) return undefined as unknown as T;

  return (await response.json()) as T;
}

// ─── Dev bypass ────────────────────────────────────────────────────────────

/**
 * Sentinel stored as the access token to indicate dev-bypass mode.
 * The student layout's getToken() check sees a non-null value and allows entry.
 * The dashboard detects this sentinel and renders mock data instead of hitting the API.
 * NEVER reaches the backend — all hooks that use it pass null/empty paths.
 */
export const DEV_BYPASS_TOKEN = '__fitgrade_dev__';

/** Sets the dev bypass token — call only in development mode. */
export function loginAsDevStudent(): void {
  setToken(DEV_BYPASS_TOKEN);
}

// ─── Auth helpers ──────────────────────────────────────────────────────────

/** Calls the logout endpoint (clears httpOnly cookie) then wipes the local token. */
export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {
    // Best-effort — clear local token regardless of network error
  });
  clearToken();
}
