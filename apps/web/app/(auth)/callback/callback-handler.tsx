'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/api-client';

/**
 * Called by the browser after Google OAuth redirect.
 * Exchanges the short-lived `login_token` httpOnly cookie for the access token
 * via POST /api/auth/exchange, then navigates to the dashboard.
 * Falls back to /login on any failure (cookie missing/expired, network error).
 */
export function CallbackHandler(): null {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      try {
        const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/auth/exchange`, { method: 'POST', credentials: 'include' });
        if (!res.ok) {
          router.replace('/login');
          return;
        }
        const data = (await res.json()) as { accessToken: string };
        setToken(data.accessToken);
        router.replace('/dashboard');
      } catch {
        router.replace('/login');
      }
    })();
  }, [router]);

  return null;
}
