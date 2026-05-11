'use client';

import { motion } from 'framer-motion';
import { BarChart3, BookOpen, Dumbbell, Users } from 'lucide-react';
import { useTour } from '@/components/tour/TourProvider';

const FEATURES = [
  { icon: Dumbbell,  text: 'רישום תוצאות מבחנים בזמן אמת', grad: '#6366f1, #8b5cf6' },
  { icon: BookOpen,  text: 'ניהול כיתות ותלמידים בקלות',    grad: '#8b5cf6, #a855f7' },
  { icon: BarChart3, text: 'דוחות ציונים לפי תקן משרד החינוך', grad: '#a855f7, #ec4899' },
  { icon: Users,     text: 'מעקב נוכחות ותלמידות',          grad: '#ec4899, #f43f5e' },
] as const;

const CARD = {
  hidden: { opacity: 0, y: 40, scale: 0.93 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 220, damping: 22, delay: 0.05 },
  },
};

const LIST = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.30 } },
};

const ITEM = {
  hidden: { opacity: 0, x: 18 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

export default function OnboardingWelcomePage(): React.JSX.Element {
  const { startTour } = useTour();

  return (
    <div className="h-screen w-full overflow-hidden flex items-start justify-center pt-8 p-4">
      <motion.div
        variants={CARD}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-[400px] overflow-hidden rounded-[28px] mx-4 sm:mx-0"
        style={{
          background:
            'linear-gradient(150deg, #1b0840 0%, #110624 45%, #090318 100%)',
          border: '1px solid rgba(167,139,250,0.20)',
          boxShadow:
            '0 0 0 1px rgba(99,102,241,0.08), 0 40px 100px rgba(0,0,0,0.70), 0 0 140px rgba(99,102,241,0.16)',
        }}
      >
        {/* ── Top violet bloom ──────────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72"
          style={{
            background:
              'radial-gradient(ellipse at 50% -5%, rgba(139,92,246,0.60) 0%, rgba(99,102,241,0.22) 40%, transparent 68%)',
          }}
        />
        {/* ── Bottom pink accent ────────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-48"
          style={{
            background:
              'radial-gradient(ellipse at 50% 115%, rgba(168,85,247,0.32) 0%, transparent 60%)',
          }}
        />

        <div className="relative px-8 pt-8 pb-7">
          {/* ── Logo ─────────────────────────────────────────────────────── */}
          <div className="-mt-3 mb-3 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_transparent.png"
              alt="FitGrade"
              className="mx-auto block object-contain"
              style={{ width: 120, height: 120 }}
            />
          </div>

          {/* ── Heading — gradient text, white on dark card ──────────── */}
          <h1
            className="mb-1 text-center text-[1.75rem] font-black tracking-tight leading-tight"
            style={{
              background:
                'linear-gradient(135deg, #c4b5fd 0%, #e879f9 52%, #fda4af 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ברוכים הבאים ל-FitGrade!
          </h1>
          <p
            className="mb-6 text-center text-[13px] font-medium"
            style={{ color: 'rgba(196,181,253,0.60)' }}
          >
            מערכת ניהול ציונים חכמה לחינוך גופני
          </p>

          {/* ── Feature list ─────────────────────────────────────────── */}
          <motion.ul
            variants={LIST}
            initial="hidden"
            animate="show"
            className="mb-6 flex flex-col gap-2.5"
            aria-label="יתרונות המערכת"
          >
            {FEATURES.map(({ icon: Icon, text, grad }) => (
              <motion.li
                key={text}
                variants={ITEM}
                className="flex items-center gap-3"
              >
                <span
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${grad})`,
                    boxShadow: `0 0 16px rgba(139,92,246,0.38)`,
                  }}
                >
                  <Icon className="h-[18px] w-[18px] text-white" aria-hidden="true" />
                </span>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: 'rgba(226,232,240,0.86)' }}
                >
                  {text}
                </span>
              </motion.li>
            ))}
          </motion.ul>

          {/* ── Divider ──────────────────────────────────────────────── */}
          <div
            className="mb-5 h-px w-full"
            style={{
              background:
                'linear-gradient(to left, transparent, rgba(167,139,250,0.38), transparent)',
            }}
            aria-hidden="true"
          />

          {/* ── CTA hint ─────────────────────────────────────────────── */}
          <p
            className="mb-4 text-center text-[12px]"
            style={{ color: 'rgba(148,163,184,0.58)' }}
          >
            סיור קצר של 15 צעדים — כל הכלים העיקריים
          </p>

          {/* ── CTA button ───────────────────────────────────────────── */}
          <motion.button
            type="button"
            onClick={startTour}
            whileHover={{
              scale: 1.03,
              y: -2,
              boxShadow:
                '0 20px 60px rgba(99,102,241,0.72), 0 0 0 1px rgba(167,139,250,0.38)',
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="relative w-full overflow-hidden rounded-2xl text-[15px] font-bold text-white"
            style={{
              background:
                'linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #a855f7 72%, #ec4899 100%)',
              boxShadow:
                '0 6px 32px rgba(99,102,241,0.58), inset 0 1px 0 rgba(255,255,255,0.16)',
              height: '52px',
            }}
            aria-label="התחל סיור מודרך"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
              }}
            />
            <span className="relative flex items-center justify-center gap-2">
              <span aria-hidden="true">✨</span>
              התחל סיור מודרך
            </span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
