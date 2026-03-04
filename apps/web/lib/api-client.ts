/**
 * Typed API client for the FitGrade NestJS backend.
 *
 * Token lifecycle:
 *  - Access token (15 min): stored in localStorage, attached as Bearer header.
 *  - Refresh token (7 days): lives in an httpOnly cookie set by the backend.
 *    The browser sends it automatically when credentials:'include' is set.
 */
import { ApiError } from '@fitgrade/types';

// process.env['API_URL'] is injected by next.config.ts and available in
// both server and client bundles.
const API_BASE: string = process.env['API_URL'] ?? 'http://localhost:3001/api';
const TOKEN_KEY = 'fitgrade_token';

// ─── Token management ──────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Typed fetch wrapper ───────────────────────────────────────────────────

interface RawErrorBody {
  message?: string;
  error?: string;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
