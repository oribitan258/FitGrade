'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { apiRequest, setToken } from '@/lib/api-client';

interface AuthResponse {
  accessToken: string;
}

export function DevLoginButton(): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await apiRequest<AuthResponse>('/auth/dev-login', {
        method: 'POST',
      });
      setToken(res.accessToken);
      router.replace('/dashboard');
    } catch {
      alert('Dev login failed. Did you run: pnpm prisma:seed?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      className="h-12 w-full"
      onClick={handleDevLogin}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? 'מתחבר...' : 'Dev Login (Bypass)'}
    </Button>
  );
}
