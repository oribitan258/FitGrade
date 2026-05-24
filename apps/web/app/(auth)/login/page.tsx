'use client';

import { motion } from 'framer-motion';
import { Activity, Dumbbell, Target, Timer, Trophy } from 'lucide-react';
import { DevLoginButton } from './dev-login-button';

const GOOGLE_AUTH_URL = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/api/auth/google`;

// ─── Floating background sports icons (×12 — doubled density) ────────────────
// Each icon continuously spins (full 360°) AND drifts large distances in x/y.
// Per-property transitions allow linear spin to coexist with easeInOut float.

const BG_ICONS: Array<{
  Icon: typeof Dumbbell;
  style: React.CSSProperties;
  duration: number;
  /** Peak y-axis travel distance in px */
  yAmp: number;
  /** Peak x-axis travel distance in px */
  xAmp: number;
}> = [
  // ── Top band ────────────────────────────────────────────────────────────────
  { Icon: Dumbbell, style: { top: '7%',  insetInlineStart: '5%',  width: 52, color: '#818cf8', opacity: 0.20 }, duration: 7,  yAmp: 50, xAmp: 28 },
  { Icon: Timer,    style: { top: '5%',  insetInlineEnd:  '9%',   width: 38, color: '#a78bfa', opacity: 0.18 }, duration: 9,  yAmp: 42, xAmp: 32 },
  { Icon: Trophy,   style: { top: '13%', insetInlineStart: '28%', width: 30, color: '#6366f1', opacity: 0.16 }, duration: 11, yAmp: 38, xAmp: 22 },
  { Icon: Target,   style: { top: '11%', insetInlineEnd:  '28%',  width: 36, color: '#818cf8', opacity: 0.17 }, duration: 8,  yAmp: 44, xAmp: 26 },
  // ── Mid band ────────────────────────────────────────────────────────────────
  { Icon: Activity, style: { top: '40%', insetInlineStart: '2%',  width: 44, color: '#a78bfa', opacity: 0.19 }, duration: 13, yAmp: 55, xAmp: 20 },
  { Icon: Dumbbell, style: { top: '38%', insetInlineEnd:  '3%',   width: 28, color: '#6366f1', opacity: 0.16 }, duration: 10, yAmp: 40, xAmp: 30 },
  { Icon: Timer,    style: { top: '52%', insetInlineStart: '18%', width: 32, color: '#818cf8', opacity: 0.14 }, duration: 15, yAmp: 35, xAmp: 24 },
  { Icon: Trophy,   style: { top: '48%', insetInlineEnd:  '16%',  width: 40, color: '#a78bfa', opacity: 0.15 }, duration: 12, yAmp: 48, xAmp: 28 },
  // ── Bottom band ─────────────────────────────────────────────────────────────
  { Icon: Target,   style: { top: '70%', insetInlineStart: '8%',  width: 46, color: '#6366f1', opacity: 0.19 }, duration: 9,  yAmp: 52, xAmp: 22 },
  { Icon: Activity, style: { top: '74%', insetInlineEnd:  '7%',   width: 34, color: '#818cf8', opacity: 0.18 }, duration: 7,  yAmp: 46, xAmp: 30 },
  { Icon: Dumbbell, style: { top: '82%', insetInlineStart: '36%', width: 28, color: '#a78bfa', opacity: 0.15 }, duration: 14, yAmp: 38, xAmp: 18 },
  { Icon: Target,   style: { top: '65%', insetInlineEnd:  '34%',  width: 24, color: '#6366f1', opacity: 0.14 }, duration: 16, yAmp: 42, xAmp: 25 },
];

export default function LoginPage(): React.JSX.Element {
  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden p-4 py-8"
      style={{
        background: 'linear-gradient(135deg, #070b1a 0%, #0d1135 40%, #0a0720 100%)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      {/* ── Aurora orbs — dark indigo/violet ─────────────────────────── */}
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 600, height: 600, top: '-15%', insetInlineStart: '-10%', background: 'rgba(99,102,241,0.38)' }}
        animate={{ x: [0, 45, -22, 0], y: [0, -32, 16, 0], scale: [1, 1.09, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 520, height: 520, bottom: '-14%', insetInlineEnd: '-10%', background: 'rgba(139,92,246,0.32)' }}
        animate={{ x: [0, -32, 22, 0], y: [0, 22, -28, 0], scale: [1, 1.12, 0.93, 1] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 340, height: 340, top: '40%', insetInlineEnd: '18%', background: 'rgba(56,189,248,0.15)' }}
        animate={{ x: [0, 28, -38, 0], y: [0, -22, 32, 0], scale: [1, 0.91, 1.14, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 280, height: 280, top: '15%', insetInlineStart: '30%', background: 'rgba(236,72,153,0.10)' }}
        animate={{ x: [0, -18, 30, 0], y: [0, 25, -15, 0], scale: [1, 1.07, 0.94, 1] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── 12 floating icons — continuous spin + large x/y drift ────── */}
      {BG_ICONS.map(({ Icon, style, duration, yAmp, xAmp }, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute"
          style={style}
          animate={{
            rotate: [0, 360],
            y: [0, yAmp, -yAmp * 0.7, yAmp * 0.4, 0],
            x: [0, -xAmp, xAmp * 0.8, -xAmp * 0.3, 0],
          }}
          transition={{
            rotate: { duration: duration * 2.5, repeat: Infinity, ease: 'linear' },
            y: { duration, repeat: Infinity, ease: 'easeInOut' },
            x: { duration: duration * 1.2, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <Icon style={{ width: style.width, height: style.width }} />
        </motion.div>
      ))}

      {/* ── Glassmorphic login card ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 24, delay: 0.1 }}
        className="relative z-10 mx-auto w-full max-w-[340px]"
      >
        {/* Glow halo behind card */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ boxShadow: '0 0 80px rgba(99,102,241,0.25), 0 0 160px rgba(139,92,246,0.14)' }}
        />

        <div
          className="relative flex flex-col rounded-3xl p-8"
          style={{
            minHeight: '460px',
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Brand */}
          <div className="mb-6 flex flex-col items-center text-center">
            <img
              src="/logo_transparent.png"
              alt="FitGrade"
              className="mx-auto -mb-8 w-44 h-44 object-contain"
            />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">FitGrade</h1>
            <p className="mt-1 text-sm font-medium" style={{ color: 'rgba(165,180,252,0.85)' }}>
              מערכת ניהול ציונים לחינוך גופני
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(148,163,184,0.70)' }}>
                כניסה למורים
              </p>
              <h2 className="mt-2 text-xl font-extrabold text-white tracking-tight">ברוכים הבאים</h2>
              <p className="mt-1 text-sm" style={{ color: 'rgba(148,163,184,0.65)' }}>
                התחברו עם חשבון Google שלכם
              </p>
            </div>

            {/* Google sign-in button */}
            <motion.a
              href={GOOGLE_AUTH_URL}
              whileHover={{ scale: 1.02, y: -2, boxShadow: '0 12px 40px rgba(99,102,241,0.55)' }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              className="relative flex w-full items-center justify-center gap-3 rounded-2xl text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #a855f7 100%)',
                boxShadow: '0 4px 24px rgba(99,102,241,0.45)',
                height: '52px',
              }}
              aria-label="כניסה עם חשבון Google"
            >
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)' }}
              />
              <GoogleIcon />
              כניסה עם Google
            </motion.a>

            {process.env['NODE_ENV'] !== 'production' && (
              <>
                <div className="relative flex items-center gap-3">
                  <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <span className="text-xs" style={{ color: 'rgba(148,163,184,0.50)' }}>או</span>
                  <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                </div>
                <DevLoginButton />
              </>
            )}

            <p className="text-center text-sm" style={{ color: 'rgba(148,163,184,0.65)' }}>
              <a
                href="/student-login"
                className="font-semibold transition-colors"
                style={{ color: 'rgba(165,180,252,0.90)' }}
                onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.color = 'rgba(199,210,254,1)'; }}
                onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.color = 'rgba(165,180,252,0.90)'; }}
              >
                כניסה לתלמידים
              </a>
            </p>

            <p className="text-center text-[11px]" style={{ color: 'rgba(100,116,139,0.70)' }}>
              <a
                href="/privacy"
                className="transition-colors hover:underline"
                style={{ color: 'rgba(100,116,139,0.70)' }}
                onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.color = 'rgba(148,163,184,0.90)'; }}
                onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.color = 'rgba(100,116,139,0.70)'; }}
              >
                מדיניות פרטיות
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

function GoogleIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
