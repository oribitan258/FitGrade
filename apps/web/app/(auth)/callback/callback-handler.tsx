'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken } from '@/lib/api-client';

/**
 * Reads the `token` query parameter injected by the backend redirect,
 * persists it to localStorage, then navigates to the dashboard.
 * Falls back to /login if the token is missing (e.g. OAuth was denied).
 */
export function CallbackHandler(): null {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token !== null && token !== '') {
      setToken(token);
      router.replace('/classes');
    } else {
      router.replace('/login');
    }
  }, [router, searchParams]);

  return null;
}
