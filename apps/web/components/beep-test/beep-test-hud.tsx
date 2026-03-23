'use client';

/**
 * BeepTestHUD — Pro Max glassmorphic scoreboard panel for the live beep test.
 *
 * PERFORMANCE CONTRACT (unchanged):
 *   Zero fast-changing state. All runtime values are written directly to DOM
 *   elements via refs. React never re-renders this component during an active test.
 *
 * Visual design (Pro Max):
 *   - Stronger glassmorphism: blur(32px) saturate(180%), deep violet box-shadow ring.
 *   - Number spotlight: radial glow behind the level/shuttle pair.
 *   - LIVE badge: pulsing red dot + "LIVE" label in top row.
 *   - Subtle 32px grid texture overlay at 2.5% opacity.
 *   - Countdown bar: 10px tall, neon glow shadow.
 *   - Two slow-rotating ambient rings (unchanged, zero React state).
 */

import type React from 'react';
import { motion } from 'framer-motion';
import { Activity, Gauge } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface BeepTestHUDProps {
  levelRef:        React.RefObject<HTMLSpanElement | null>;
  shuttleRef:      React.RefObject<HTMLSpanElement | null>;
  /** Ref to the numeric speed value only — unit label (קמ\"ש) is static text. */
  speedRef:        React.RefObject<HTMLSpanElement | null>;
  /** Ref to the qualitative level-description line. */
  levelDescRef:    React.RefObject<HTMLSpanElement | null>;
  /** Ref to the inner fill div of the countdown bar. */
  countdownBarRef: React.RefObject<HTMLDivElement | null>;
  startLevel:      number;
  startSpeedKmh:   number;
  startLevelDesc:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BeepTestHUD({
  levelRef,
  shuttleRef,
  speedRef,
  levelDescRef,
  countdownBarRef,
  startLevel,
  startSpeedKmh,
  startLevelDesc,
}: BeepTestHUDProps): React.JSX.Element {
  return (
    <div
      className="relative w-full select-none overflow-hidden rounded-3xl"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: [
          '0 8px 48px rgba(0,0,0,0.50)',
          'inset 0 1px 0 rgba(255,255,255,0.10)',
          '0 0 0 1px rgba(109,40,217,0.18)',
          '0 0 40px rgba(109,40,217,0.12)',
        ].join(', '),
      }}
      dir="rtl"
      aria-live="off"
      aria-label="תצוגת מבחן ביפ"
    >
      {/* ── Subtle grid texture ──────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '32px 32px',
          opacity: 0.025,
        }}
        aria-hidden="true"
      />

      {/* ── Ambient violet glow behind numbers ──────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 70%, rgba(109,40,217,0.22) 0%, transparent 65%)',
        }}
        aria-hidden="true"
      />

      {/* ── Top row: speed pill · LIVE badge · level description ────────── */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4">
        {/* Speed pill */}
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{
            background: 'rgba(34,197,94,0.14)',
            border: '1px solid rgba(34,197,94,0.28)',
            boxShadow: '0 0 12px rgba(34,197,94,0.15)',
          }}
        >
          <Gauge className="h-3 w-3 text-emerald-400" aria-hidden="true" />
          <span
            ref={speedRef}
            className="tabular-nums text-sm font-black text-emerald-300"
            aria-label="מהירות נוכחית"
          >
            {startSpeedKmh}
          </span>
          <span className="text-[10px] font-semibold text-emerald-500/60">קמ&quot;ש</span>
        </div>

        {/* LIVE badge */}
        <div className="flex items-center gap-1.5">
          <motion.div
            className="h-2 w-2 rounded-full bg-red-500"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-black uppercase tracking-[0.20em] text-red-400">
            LIVE
          </span>
        </div>

        {/* Level description */}
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-violet-400/70" aria-hidden="true" />
          <span
            ref={levelDescRef}
            className="text-xs font-bold text-violet-300/80"
            aria-label="עצימות רמה"
          >
            {startLevelDesc}
          </span>
        </div>
      </div>

      {/* ── Main scoreboard: LEVEL · SHUTTLE ──────────────────────────── */}
      <div className="relative flex items-end justify-center gap-4 pb-3 pt-2">

        {/* Number spotlight glow — behind the digits */}
        <div
          className="pointer-events-none absolute"
          style={{
            insetInlineStart: '50%',
            transform: 'translateX(-50%)',
            top: '10%',
            width: '60%',
            height: '80%',
            background: 'radial-gradient(ellipse, rgba(109,40,217,0.20) 0%, transparent 70%)',
            filter: 'blur(12px)',
          }}
          aria-hidden="true"
        />

        {/* Ambient slow-rotating rings — pure decoration, no React state ──── */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <motion.div
            className="h-52 w-52 rounded-full"
            style={{ border: '1px solid rgba(139,92,246,0.12)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute h-36 w-36 rounded-full"
            style={{ border: '1px solid rgba(139,92,246,0.08)' }}
            animate={{ rotate: -360 }}
            transition={{ duration: 17, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Level ──────────────────────────────────────────────────────── */}
        <div className="relative z-10 flex flex-col items-center">
          <span className="mb-0.5 text-[9px] font-black uppercase tracking-[0.22em] text-white/30">
            רמה
          </span>
          <span
            ref={levelRef}
            className="bg-gradient-to-b from-white via-white to-white/70 bg-clip-text font-black tabular-nums leading-none text-transparent"
            style={{
              fontSize: 'clamp(4rem, 18vw, 6.5rem)',
              letterSpacing: '-0.04em',
              textShadow: '0 0 40px rgba(139,92,246,0.30)',
            }}
            aria-label="רמה נוכחית"
          >
            {startLevel}
          </span>
        </div>

        {/* Separator ──────────────────────────────────────────────────── */}
        <span className="relative z-10 mb-8 text-2xl font-black text-white/15" aria-hidden="true">
          ·
        </span>

        {/* Shuttle ─────────────────────────────────────────────────────── */}
        <div className="relative z-10 flex flex-col items-center">
          <span className="mb-0.5 text-[9px] font-black uppercase tracking-[0.22em] text-white/30">
            מעבר
          </span>
          <span
            ref={shuttleRef}
            className="font-black tabular-nums leading-none text-white/45"
            style={{ fontSize: 'clamp(4rem, 18vw, 6.5rem)', letterSpacing: '-0.04em' }}
            aria-label="מעבר נוכחי"
          >
            1
          </span>
        </div>
      </div>

      {/* ── Countdown bar ─────────────────────────────────────────────── */}
      <div className="px-4 pb-5">
        {/* Track */}
        <div
          className="w-full overflow-hidden rounded-full"
          style={{ height: 10, background: 'rgba(255,255,255,0.07)' }}
          role="progressbar"
          aria-label="זמן עד הביפ הבא"
        >
          {/* Fill — collapses via scaleX(0) driven by the Web Animations API in useBeepEngine */}
          <div
            ref={countdownBarRef}
            className="h-full w-full origin-start rounded-full"
            style={{
              background: 'linear-gradient(90deg, #22c55e 0%, #84cc16 35%, #eab308 70%, #f97316 100%)',
              transform: 'scaleX(1)',
              willChange: 'transform',
              boxShadow: '0 0 10px rgba(34,197,94,0.50)',
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
