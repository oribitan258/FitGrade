/**
 * OAuth callback landing page.
 *
 * The backend redirects here after Google OAuth:
 *   GET /auth/callback?token=<accessToken>
 *
 * CallbackHandler (client component) reads the token from the URL,
 * saves it to localStorage, then redirects to /dashboard.
 * It must be wrapped in <Suspense> because useSearchParams() requires it.
 */
import { Suspense } from 'react';
import { GraduationCap } from 'lucide-react';
import { CallbackHandler } from './callback-handler';
import { LoginLoader } from '@/components/ui/login-loader';

// ─── Shared loading UI (shown both as Suspense fallback and as page body) ──────

function LoadingCard(): React.JSX.Element {
  return (
    <div className="relative z-10 flex flex-col items-center gap-6 rounded-3xl px-12 py-10"
      style={{
        background:           'rgba(255,255,255,0.06)',
        backdropFilter:       'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border:               '1px solid rgba(255,255,255,0.10)',
        boxShadow:            '0 24px 80px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {/* Brand icon */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          boxShadow:  '0 0 32px rgba(99,102,241,0.65), 0 0 64px rgba(139,92,246,0.30)',
        }}
      >
        <GraduationCap className="h-8 w-8 text-white" aria-hidden="true" />
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-lg font-extrabold text-white tracking-tight">FitGrade</h1>
        <p className="mt-1 text-sm" style={{ color: 'rgba(165,180,252,0.75)' }}>
          מאמת את הכניסה שלך...
        </p>
      </div>

      {/* Animated loader */}
      <LoginLoader variant="purple" label="מחובר עם Google" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CallbackPage(): React.JSX.Element {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{ background: 'linear-gradient(135deg, #070b1a 0%, #0d1135 40%, #0a0720 100%)' }}
    >
      {/* ── Aurora orbs — dark indigo/violet ──────────────────────────── */}
      <div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 600, height: 600, top: '-15%', insetInlineStart: '-10%', background: 'rgba(99,102,241,0.38)' }}
      />
      <div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 520, height: 520, bottom: '-14%', insetInlineEnd: '-10%', background: 'rgba(139,92,246,0.32)' }}
      />
      <div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 340, height: 340, top: '40%', insetInlineEnd: '18%', background: 'rgba(56,189,248,0.15)' }}
      />

      {/* Glow halo behind card */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          className="h-80 w-80 rounded-full blur-3xl"
          style={{ background: 'rgba(99,102,241,0.18)' }}
        />
      </div>

      {/* Loading card — always visible */}
      <LoadingCard />

      {/* Token processor — renders nothing, just handles redirect */}
      <Suspense fallback={null}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
