'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Activity, CreditCard, Dumbbell, Eye, EyeOff, KeyRound, Lock, Trophy, Zap } from 'lucide-react';
import { apiRequest, DEV_BYPASS_TOKEN, setToken } from '@/lib/api-client';
import { ApiError } from '@fitgrade/types';
import { LoginLoader } from '@/components/ui/login-loader';

// ─── Validation schema ────────────────────────────────────────────────────────

const studentLoginSchema = z.object({
  nationalId: z.string().regex(/^\d{1,9}$/, 'תעודת זהות לא תקינה (ספרות בלבד, עד 9)'),
  password:   z.string().optional(),
});

type StudentLoginInput = z.infer<typeof studentLoginSchema>;

interface AuthResponse {
  accessToken: string;
}

// ─── Floating background sports icons (×12 — doubled density) ────────────────

const BG_ICONS: Array<{
  Icon: typeof Dumbbell;
  style: React.CSSProperties;
  duration: number;
  yAmp: number;
  xAmp: number;
}> = [
  { Icon: Dumbbell, style: { top: '7%',  insetInlineStart: '5%',  width: 52, color: '#34d399', opacity: 0.20 }, duration: 8,  yAmp: 50, xAmp: 28 },
  { Icon: Trophy,   style: { top: '5%',  insetInlineEnd:  '9%',   width: 38, color: '#2dd4bf', opacity: 0.18 }, duration: 11, yAmp: 42, xAmp: 32 },
  { Icon: Activity, style: { top: '13%', insetInlineStart: '28%', width: 30, color: '#22d3ee', opacity: 0.16 }, duration: 9,  yAmp: 38, xAmp: 22 },
  { Icon: Zap,      style: { top: '11%', insetInlineEnd:  '28%',  width: 36, color: '#34d399', opacity: 0.17 }, duration: 7,  yAmp: 44, xAmp: 26 },
  { Icon: Dumbbell, style: { top: '40%', insetInlineStart: '2%',  width: 44, color: '#2dd4bf', opacity: 0.19 }, duration: 14, yAmp: 55, xAmp: 20 },
  { Icon: Activity, style: { top: '38%', insetInlineEnd:  '3%',   width: 28, color: '#10b981', opacity: 0.16 }, duration: 10, yAmp: 40, xAmp: 30 },
  { Icon: Trophy,   style: { top: '52%', insetInlineStart: '18%', width: 32, color: '#34d399', opacity: 0.14 }, duration: 15, yAmp: 35, xAmp: 24 },
  { Icon: Zap,      style: { top: '48%', insetInlineEnd:  '16%',  width: 40, color: '#2dd4bf', opacity: 0.15 }, duration: 12, yAmp: 48, xAmp: 28 },
  { Icon: Activity, style: { top: '70%', insetInlineStart: '8%',  width: 46, color: '#10b981', opacity: 0.19 }, duration: 9,  yAmp: 52, xAmp: 22 },
  { Icon: Dumbbell, style: { top: '74%', insetInlineEnd:  '7%',   width: 34, color: '#34d399', opacity: 0.18 }, duration: 7,  yAmp: 46, xAmp: 30 },
  { Icon: Trophy,   style: { top: '82%', insetInlineStart: '36%', width: 28, color: '#2dd4bf', opacity: 0.15 }, duration: 14, yAmp: 38, xAmp: 18 },
  { Icon: Zap,      style: { top: '65%', insetInlineEnd:  '34%',  width: 24, color: '#10b981', opacity: 0.14 }, duration: 16, yAmp: 42, xAmp: 25 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentLoginPage(): React.JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Consent is stored in localStorage so it is only requested once per device.
  // On first visit the key is absent → show the checkbox.
  // After the student checks it and logs in successfully the key is written.
  const [hasStoredConsent] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('fitgrade-student-consent-v1') !== null,
  );
  const [consentChecked, setConsentChecked] = useState(false);
  // Effective consent: already stored OR checked right now
  const canSubmit = hasStoredConsent || consentChecked;

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
        body: JSON.stringify({ nationalId: data.nationalId, password: data.password }),
      });
      setToken(response.accessToken);
      // Persist consent so the checkbox is not shown on future logins from this device.
      localStorage.setItem('fitgrade-student-consent-v1', new Date().toISOString());
      router.replace('/student-dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        // Backend returns 404 with message 'STUDENT_NOT_FOUND' when the ID is
        // not in the DB — show the long, redirecting Hebrew message that
        // points the student to their PE teacher (vs. generic credential errors).
        if (err.statusCode === 404 && err.message === 'STUDENT_NOT_FOUND') {
          setServerError('תעודת הזהות לא נמצאה במערכת. אנא פנה למורה לחינוך גופני שלך.');
          return;
        }
        if (err.statusCode === 401) {
          // Backend distinguishes 'תעודת זהות לא תקינה' (Luhn fail) from
          // 'סיסמה שגויה' (wrong password). Surface the backend's Hebrew
          // message directly when it's known; otherwise fall back.
          setServerError(err.message || 'תעודת זהות או סיסמה שגויים');
          return;
        }
        if (err.statusCode === 429) {
          setServerError('יותר מדי ניסיונות. נסה שוב בעוד דקה.');
          return;
        }
      }
      setServerError('שגיאת שרת. נסה שוב.');
    }
  };

  const nationalIdField = register('nationalId');
  const passwordField   = register('password');

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden p-4 py-8"
      style={{
        background: 'linear-gradient(135deg, #021a0e 0%, #032710 40%, #040d1a 100%)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      {/* ── Aurora orbs ──────────────────────────────────────────────── */}
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

      {/* ── Floating icons ───────────────────────────────────────────── */}
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
        {/* Glow halo */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ boxShadow: '0 0 80px rgba(16,185,129,0.22), 0 0 160px rgba(5,150,105,0.12)' }}
        />

        <div
          className="relative flex flex-col rounded-3xl p-8"
          style={{
            minHeight: '280px',
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Brand */}
          <div className="mb-5 flex flex-col items-center text-center">
            <img
              src="/logo_transparent.png"
              alt="FitGrade"
              className="mx-auto -mb-4 w-24 h-24 object-contain"
            />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">FitGrade</h1>
            <p className="mt-1 text-sm font-medium" style={{ color: 'rgba(110,231,183,0.85)' }}>
              פורטל תלמידים
            </p>
          </div>

          <p className="mb-5 text-center text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(148,163,184,0.70)' }}>
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
            {/* National ID */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nationalId" className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(110,231,183,0.70)' }}>
                תעודת זהות
              </label>
              <div className="relative">
                <CreditCard
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: 'rgba(52,211,153,0.55)' }}
                  aria-hidden="true"
                />
                <input
                  id="nationalId"
                  inputMode="numeric"
                  pattern="\d{1,9}"
                  maxLength={9}
                  autoComplete="off"
                  placeholder="תעודת זהות"
                  dir="ltr"
                  className="h-11 w-full rounded-xl ps-10 pe-4 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: errors.nationalId ? '1px solid rgba(239,68,68,0.60)' : '1px solid rgba(255,255,255,0.10)',
                  }}
                  {...nationalIdField}
                  onFocus={(e) => { if (!errors.nationalId) e.currentTarget.style.border = '1px solid rgba(16,185,129,0.60)'; }}
                  onBlur={(e) => { void nationalIdField.onBlur(e); e.currentTarget.style.border = errors.nationalId ? '1px solid rgba(239,68,68,0.60)' : '1px solid rgba(255,255,255,0.10)'; }}
                  aria-describedby={errors.nationalId ? 'nationalId-error' : undefined}
                />
              </div>
              {errors.nationalId && (
                <p id="nationalId-error" className="text-xs" style={{ color: 'rgba(252,165,165,0.90)' }}>{errors.nationalId.message}</p>
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
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="סיסמה"
                  dir="ltr"
                  className="h-11 w-full rounded-xl ps-10 pe-10 text-sm text-white placeholder:text-white/30 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  {...passwordField}
                  onFocus={(e) => { e.currentTarget.style.border = '1px solid rgba(16,185,129,0.60)'; }}
                  onBlur={(e) => { void passwordField.onBlur(e); e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                    : <Eye    className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Consent checkbox — shown only on first login from this device */}
            {!hasStoredConsent && (
              <label className="flex cursor-pointer items-start gap-2.5 pt-1" dir="rtl">
                <span className="relative mt-0.5 flex shrink-0">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => { setConsentChecked(e.target.checked); }}
                    className="peer sr-only"
                    aria-required="true"
                    aria-label="אישור תנאי שימוש"
                  />
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded border transition-all duration-150"
                    style={{
                      background: consentChecked ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.06)',
                      borderColor: consentChecked ? 'transparent' : 'rgba(52,211,153,0.35)',
                      boxShadow: consentChecked ? '0 0 8px rgba(16,185,129,0.45)' : 'none',
                    }}
                    aria-hidden="true"
                  >
                    {consentChecked && (
                      <svg viewBox="0 0 12 10" fill="none" className="h-2.5 w-2.5" aria-hidden="true">
                        <path d="M1.5 5L4.5 8L10.5 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </span>
                <span className="text-[11px] leading-[1.6]" style={{ color: 'rgba(148,163,184,0.70)' }}>
                  קראתי ואני מסכים/ה ל
                  <a href="/terms" target="_blank" rel="noopener noreferrer"
                    onClick={(e) => { e.stopPropagation(); }}
                    className="font-semibold underline underline-offset-2"
                    style={{ color: 'rgba(52,211,153,0.90)' }}>
                    תנאי השימוש
                  </a>
                  {' '}ול
                  <a href="/privacy" target="_blank" rel="noopener noreferrer"
                    onClick={(e) => { e.stopPropagation(); }}
                    className="font-semibold underline underline-offset-2"
                    style={{ color: 'rgba(52,211,153,0.90)' }}>
                    מדיניות הפרטיות
                  </a>
                  {' '}של FitGrade, ומבין/ה שמוסד החינוך מנהל את נתוני הכושר שלי לצורכי הערכה פדגוגית בלבד.
                </span>
              </label>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              whileHover={canSubmit ? { scale: 1.02, y: -2, boxShadow: '0 12px 40px rgba(16,185,129,0.50)' } : {}}
              whileTap={canSubmit ? { scale: 0.97 } : {}}
              transition={{ type: 'spring', stiffness: 380, damping: 24 }}
              className="relative mt-1 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)',
                boxShadow: canSubmit ? '0 4px 24px rgba(16,185,129,0.45)' : 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
              aria-busy={isSubmitting}
              aria-disabled={!canSubmit}
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

          <p className="mt-4 text-center text-sm" style={{ color: 'rgba(148,163,184,0.65)' }}>
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

          <p className="mt-3 text-center text-[11px]" style={{ color: 'rgba(100,116,139,0.70)' }}>
            <a
              href="/privacy"
              className="transition-colors hover:underline"
              style={{ color: 'rgba(100,116,139,0.70)' }}
              onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.color = 'rgba(148,163,184,0.90)'; }}
              onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.color = 'rgba(148,163,184,0.90)'; }}
            >
              מדיניות פרטיות
            </a>
          </p>

          {process.env['NODE_ENV'] === 'development' && (
            <button
              type="button"
              onClick={() => {
                setToken(DEV_BYPASS_TOKEN);
                router.replace('/student-dashboard');
              }}
              className="mt-3 w-full rounded-xl border border-dashed py-2 text-[11px] font-mono font-semibold transition-colors"
              style={{
                borderColor: 'rgba(52,211,153,0.30)',
                color: 'rgba(52,211,153,0.65)',
                background: 'rgba(16,185,129,0.05)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(52,211,153,0.60)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(52,211,153,0.90)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(52,211,153,0.30)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(52,211,153,0.65)'; }}
            >
              ⚡ Dev: כניסה כתלמיד מבחן
            </button>
          )}
        </div>
      </motion.div>
    </main>
  );
}
