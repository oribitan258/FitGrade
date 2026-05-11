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
  const [loading,           setLoading]           = useState(false);
  const [simulateFirstLogin, setSimulateFirstLogin] = useState(false);

  const handleDevLogin = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await apiRequest<AuthResponse>('/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify({ simulateFirstLogin }),
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
    <div className="flex flex-col gap-2 w-full">
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

      <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-500 justify-center">
        <input
          type="checkbox"
          checked={simulateFirstLogin}
          onChange={(e) => { setSimulateFirstLogin(e.target.checked); }}
          className="h-3.5 w-3.5 accent-violet-600"
        />
        Simulate First Login (resets onboarding)
      </label>
    </div>
  );
}
