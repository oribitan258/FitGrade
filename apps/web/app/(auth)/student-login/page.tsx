'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Activity, Dumbbell, Hash, KeyRound, Lock, Trophy, User, Zap } from 'lucide-react';
import { apiRequest, setToken } from '@/lib/api-client';
import { ApiError } from '@fitgrade/types';
import { LoginLoader } from '@/components/ui/login-loader';

// ─── Validation schema ────────────────────────────────────────────────────────

const studentLoginSchema = z.object({
  classCode:   z.string().min(1, 'קוד הכיתה חובה'),
  studentCode: z.string().min(1, 'קוד התלמיד חובה'),
  password:    z.string().min(1, 'סיסמה חובה'),
});

type StudentLoginInput = z.infer<typeof studentLoginSchema>;

interface AuthResponse {
  accessToken: string;
}

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
  { Icon: Dumbbell, style: { top: '7%',  insetInlineStart: '5%',  width: 52, color: '#34d399', opacity: 0.20 }, duration: 8,  yAmp: 50, xAmp: 28 },
  { Icon: Trophy,   style: { top: '5%',  insetInlineEnd:  '9%',   width: 38, color: '#2dd4bf', opacity: 0.18 }, duration: 11, yAmp: 42, xAmp: 32 },
  { Icon: Activity, style: { top: '13%', insetInlineStart: '28%', width: 30, color: '#22d3ee', opacity: 0.16 }, duration: 9,  yAmp: 38, xAmp: 22 },
  { Icon: Zap,      style: { top: '11%', insetInlineEnd:  '28%',  width: 36, color: '#34d399', opacity: 0.17 }, duration: 7,  yAmp: 44, xAmp: 26 },
  // ── Mid band ────────────────────────────────────────────────────────────────
  { Icon: Dumbbell, style: { top: '40%', insetInlineStart: '2%',  width: 44, color: '#2dd4bf', opacity: 0.19 }, duration: 14, yAmp: 55, xAmp: 20 },
  { Icon: Activity, style: { top: '38%', insetInlineEnd:  '3%',   width: 28, color: '#10b981', opacity: 0.16 }, duration: 10, yAmp: 40, xAmp: 30 },
  { Icon: Trophy,   style: { top: '52%', insetInlineStart: '18%', width: 32, color: '#34d399', opacity: 0.14 }, duration: 15, yAmp: 35, xAmp: 24 },
  { Icon: Zap,      style: { top: '48%', insetInlineEnd:  '16%',  width: 40, color: '#2dd4bf', opacity: 0.15 }, duration: 12, yAmp: 48, xAmp: 28 },
  // ── Bottom band ─────────────────────────────────────────────────────────────
  { Icon: Activity, style: { top: '70%', insetInlineStart: '8%',  width: 46, color: '#10b981', opacity: 0.19 }, duration: 9,  yAmp: 52, xAmp: 22 },
  { Icon: Dumbbell, style: { top: '74%', insetInlineEnd:  '7%',   width: 34, color: '#34d399', opacity: 0.18 }, duration: 7,  yAmp: 46, xAmp: 30 },
  { Icon: Trophy,   style: { top: '82%', insetInlineStart: '36%', width: 28, color: '#2dd4bf', opacity: 0.15 }, duration: 14, yAmp: 38, xAmp: 18 },
  { Icon: Zap,      style: { top: '65%', insetInlineEnd:  '34%',  width: 24, color: '#10b981', opacity: 0.14 }, duration: 16, yAmp: 42, xAmp: 25 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentLoginPage(): React.JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudentLoginInput>({ resolver: zodResolver(studentLoginSchema) });

  const onSubmit = async (data: StudentLoginInput): Promise<void> => {
    setServerError(null);
    try {
      const response = await apiRequest<AuthResponse>('/auth/student', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setToken(response.accessToken);
      router.replace('/student-dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        setServerError('קוד הכיתה, קוד התלמיד או הסיסמה שגויים');
      } else {
        setServerError('שגיאת שרת. נסה שוב.');
      }
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden overflow-x-hidden p-4"
      style={{ background: 'linear-gradient(135deg, #021a0e 0%, #032710 40%, #040d1a 100%)' }}
    >
      {/* ── Aurora orbs — dark emerald/teal ──────────────────────────── */}
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 600, height: 600, top: '-15%', insetInlineStart: '-10%', background: 'rgba(16,185,129,0.34)' }}
        animate={{ x: [0, 38, -18, 0], y: [0, -28, 18, 0], scale: [1, 1.10, 0.96, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 520, height: 520, bottom: '-14%', insetInlineEnd: '-10%', background: 'rgba(5,150,105,0.30)' }}
        animate={{ x: [0, -32, 22, 0], y: [0, 22, -28, 0], scale: [1, 1.12, 0.93, 1] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 340, height: 340, top: '40%', insetInlineEnd: '18%', background: 'rgba(45,212,191,0.20)' }}
        animate={{ x: [0, 18, -26, 0], y: [0, -14, 22, 0], scale: [1, 0.93, 1.11, 1] }}
        transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 280, height: 280, top: '12%', insetInlineStart: '28%', background: 'rgba(251,191,36,0.08)' }}
        animate={{ x: [0, -14, 18, 0], y: [0, 18, -10, 0], scale: [1, 1.05, 0.96, 1] }}
        transition={{ duration: 23, repeat: Infinity, ease: 'easeInOut' }}
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
        className="relative z-10 w-full max-w-sm"
      >
        {/* Glow halo behind card */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ boxShadow: '0 0 80px rgba(16,185,129,0.22), 0 0 160px rgba(5,150,105,0.12)' }}
        />

        <div
          className="relative rounded-3xl p-8"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Brand */}
          <div className="mb-7 flex flex-col items-center text-center">
            <motion.div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 0 32px rgba(16,185,129,0.65), 0 0 64px rgba(5,150,105,0.28)',
              }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Trophy className="h-8 w-8 text-white" aria-hidden="true" />
            </motion.div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">FitGrade</h1>
            <p className="mt-1 text-sm font-medium" style={{ color: 'rgba(110,231,183,0.85)' }}>
              פורטל תלמידים
            </p>
          </div>

          <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(148,163,184,0.70)' }}>
            כניסה לתלמידים
          </p>

          {/* Server error */}
          {serverError !== null && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="mb-4 rounded-xl px-4 py-3 text-sm text-red-300"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {serverError}
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {/* Class code */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="classCode" className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(110,231,183,0.70)' }}>
                קוד הכיתה
              </label>
              <div className="relative">
                <Hash
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'rgba(52,211,153,0.55)' }}
                  aria-hidden="true"
                />
                <input
                  id="classCode"
                  type="text"
                  autoComplete="off"
                  placeholder="לדוגמה: CLASS10"
                  dir="ltr"
                  className="h-11 w-full rounded-xl ps-10 pe-4 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: errors.classCode ? '1px solid rgba(239,68,68,0.60)' : '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={(e) => { if (!errors.classCode) e.currentTarget.style.border = '1px solid rgba(16,185,129,0.60)'; }}
                  onBlur={(e) => { e.currentTarget.style.border = errors.classCode ? '1px solid rgba(239,68,68,0.60)' : '1px solid rgba(255,255,255,0.10)'; }}
                  aria-describedby={errors.classCode ? 'classCode-error' : undefined}
                  {...register('classCode')}
                />
              </div>
              {errors.classCode && (
                <p id="classCode-error" className="text-xs" style={{ color: 'rgba(252,165,165,0.90)' }}>{errors.classCode.message}</p>
              )}
            </div>

            {/* Student code */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="studentCode" className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(110,231,183,0.70)' }}>
                קוד תלמיד
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'rgba(52,211,153,0.55)' }}
                  aria-hidden="true"
                />
                <input
                  id="studentCode"
                  type="text"
                  autoComplete="username"
                  placeholder="לדוגמה: 12345"
                  dir="ltr"
                  className="h-11 w-full rounded-xl ps-10 pe-4 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: errors.studentCode ? '1px solid rgba(239,68,68,0.60)' : '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={(e) => { if (!errors.studentCode) e.currentTarget.style.border = '1px solid rgba(16,185,129,0.60)'; }}
                  onBlur={(e) => { e.currentTarget.style.border = errors.studentCode ? '1px solid rgba(239,68,68,0.60)' : '1px solid rgba(255,255,255,0.10)'; }}
                  aria-describedby={errors.studentCode ? 'studentCode-error' : undefined}
                  {...register('studentCode')}
                />
              </div>
              {errors.studentCode && (
                <p id="studentCode-error" className="text-xs" style={{ color: 'rgba(252,165,165,0.90)' }}>{errors.studentCode.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(110,231,183,0.70)' }}>
                סיסמה
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'rgba(52,211,153,0.55)' }}
                  aria-hidden="true"
                />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="הזן סיסמה"
                  className="h-11 w-full rounded-xl ps-10 pe-4 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: errors.password ? '1px solid rgba(239,68,68,0.60)' : '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={(e) => { if (!errors.password) e.currentTarget.style.border = '1px solid rgba(16,185,129,0.60)'; }}
                  onBlur={(e) => { e.currentTarget.style.border = errors.password ? '1px solid rgba(239,68,68,0.60)' : '1px solid rgba(255,255,255,0.10)'; }}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p id="password-error" className="text-xs" style={{ color: 'rgba(252,165,165,0.90)' }}>{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.02, y: -2, boxShadow: '0 12px 40px rgba(16,185,129,0.50)' }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              className="relative mt-1 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)',
                boxShadow: '0 4px 24px rgba(16,185,129,0.45)',
              }}
              aria-busy={isSubmitting}
            >
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 60%)' }}
              />
              {isSubmitting ? (
                <LoginLoader variant="green" />
              ) : (
                <>
                  <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                  כניסה
                </>
              )}
            </motion.button>
          </form>

          <p className="mt-5 text-center text-sm" style={{ color: 'rgba(148,163,184,0.65)' }}>
            <a
              href="/login"
              className="font-semibold transition-colors"
              style={{ color: 'rgba(110,231,183,0.90)' }}
              onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.color = 'rgba(167,243,208,1)'; }}
              onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.color = 'rgba(110,231,183,0.90)'; }}
            >
              כניסה למורים
            </a>
          </p>

          {process.env['NODE_ENV'] !== 'production' && (
            <p className="mt-3 text-center font-mono text-[11px]" style={{ color: 'rgba(148,163,184,0.35)' }}>
              Dev: CLASS10 / 12345 / password123
            </p>
          )}
        </div>
      </motion.div>
    </main>
  );
}
