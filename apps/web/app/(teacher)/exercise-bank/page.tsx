'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, CheckCircle2, ChevronDown, ChevronUp,
  Dumbbell, Flame, Heart, Layers, RotateCcw, Sparkles, RefreshCw,
  Star, Target, Wind, Zap, Users, User,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

type Phase = 'warmup' | 'main' | 'cooldown';
type Difficulty = 'easy' | 'medium' | 'hard';
type LessonGender = 'MALE' | 'FEMALE' | 'MIXED';
type AgeGroup = 'middle' | 'high';
type GoalType =
  | 'כושר כללי' | 'שיפור גמישות' | 'אירובי' | 'כוח ועמידות' | 'מיומנויות כדור'
  | 'HIIT עצימות גבוהה' | 'כוח ליבה' | 'עבודת תחנות' | 'כוח ושרירים' | 'גמישות ורגיעה';

interface Exercise {
  id: string;
  phase: Phase;
  goal: GoalType | 'all';
  minDifficulty: Difficulty;
  nameHe: string;
  duration: string;
  reps?: string;
  instructions: string[];
}

interface LessonStep extends Exercise {
  done: boolean;
  expanded: boolean;
}

// ─── Phase Config ──────────────────────────────────────────────────────────

const PHASE_CONFIG = {
  warmup: {
    label: 'חימום', emoji: '🔆',
    gradient: 'from-orange-500 to-amber-400',
    cardBorder: 'border-orange-200', accentBorder: 'border-s-orange-400',
    iconBg: 'bg-orange-100', iconColor: 'text-orange-600',
    glow: 'shadow-[0_6px_24px_rgba(249,115,22,0.20)]',
    headerGlow: 'shadow-[0_6px_24px_rgba(249,115,22,0.45)]',
    text: 'text-orange-700', progressBar: 'bg-orange-400',
  },
  main: {
    label: 'גוף השיעור', emoji: '⚡',
    gradient: 'from-indigo-600 to-violet-500',
    cardBorder: 'border-indigo-200', accentBorder: 'border-s-indigo-500',
    iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
    glow: 'shadow-[0_6px_24px_rgba(99,102,241,0.20)]',
    headerGlow: 'shadow-[0_6px_24px_rgba(99,102,241,0.50)]',
    text: 'text-indigo-700', progressBar: 'bg-indigo-500',
  },
  cooldown: {
    label: 'שחרור', emoji: '🌊',
    gradient: 'from-teal-500 to-emerald-400',
    cardBorder: 'border-teal-200', accentBorder: 'border-s-teal-400',
    iconBg: 'bg-teal-100', iconColor: 'text-teal-600',
    glow: 'shadow-[0_6px_24px_rgba(20,184,166,0.20)]',
    headerGlow: 'shadow-[0_6px_24px_rgba(20,184,166,0.40)]',
    text: 'text-teal-700', progressBar: 'bg-teal-500',
  },
} as const;

// ─── Goal Config ──────────────────────────────────────────────────────────

const GOALS: GoalType[] = [
  'כושר כללי', 'שיפור גמישות', 'אירובי', 'כוח ועמידות', 'מיומנויות כדור',
  'HIIT עצימות גבוהה', 'כוח ליבה', 'עבודת תחנות', 'כוח ושרירים', 'גמישות ורגיעה',
];

const GOAL_CONFIG: Record<GoalType, { icon: LucideIcon; activeBg: string; activeShadow: string }> = {
  'כושר כללי':          { icon: Activity, activeBg: 'bg-slate-700',   activeShadow: 'shadow-[0_0_16px_rgba(51,65,85,0.50)]'   },
  'שיפור גמישות':       { icon: Wind,     activeBg: 'bg-sky-500',     activeShadow: 'shadow-[0_0_16px_rgba(14,165,233,0.55)]'  },
  'אירובי':             { icon: Flame,    activeBg: 'bg-orange-500',  activeShadow: 'shadow-[0_0_16px_rgba(249,115,22,0.55)]'  },
  'כוח ועמידות':        { icon: Dumbbell, activeBg: 'bg-blue-600',    activeShadow: 'shadow-[0_0_16px_rgba(37,99,235,0.55)]'   },
  'מיומנויות כדור':     { icon: Target,   activeBg: 'bg-emerald-500', activeShadow: 'shadow-[0_0_16px_rgba(16,185,129,0.55)]'  },
  'HIIT עצימות גבוהה':  { icon: Zap,      activeBg: 'bg-red-500',     activeShadow: 'shadow-[0_0_16px_rgba(239,68,68,0.60)]'   },
  'כוח ליבה':           { icon: Layers,   activeBg: 'bg-violet-600',  activeShadow: 'shadow-[0_0_16px_rgba(124,58,237,0.55)]'  },
  'עבודת תחנות':        { icon: Star,     activeBg: 'bg-amber-500',   activeShadow: 'shadow-[0_0_16px_rgba(245,158,11,0.55)]'  },
  'כוח ושרירים':        { icon: Dumbbell, activeBg: 'bg-indigo-600',  activeShadow: 'shadow-[0_0_16px_rgba(79,70,229,0.55)]'   },
  'גמישות ורגיעה':      { icon: Wind,     activeBg: 'bg-teal-500',    activeShadow: 'shadow-[0_0_16px_rgba(20,184,166,0.55)]'  },
};

// ─── Difficulty Config ────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<Difficulty, {
  label: string; subtitle: string; flameCount: number;
  activeBg: string; activeShadow: string; activeText: string; dotColor: string;
}> = {
  easy:   { label: 'קל',     subtitle: 'בסיסי',   flameCount: 1, activeBg: 'bg-emerald-500', activeShadow: 'shadow-[0_0_20px_rgba(16,185,129,0.55)]', activeText: 'text-white', dotColor: 'bg-emerald-400' },
  medium: { label: 'בינוני', subtitle: 'מאתגר',   flameCount: 2, activeBg: 'bg-amber-500',   activeShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.55)]',  activeText: 'text-white', dotColor: 'bg-amber-400'   },
  hard:   { label: 'קשה',    subtitle: 'עצים',    flameCount: 3, activeBg: 'bg-red-500',      activeShadow: 'shadow-[0_0_20px_rgba(239,68,68,0.60)]',   activeText: 'text-white', dotColor: 'bg-red-400'     },
};

// ─── Gender Config ────────────────────────────────────────────────────────

const GENDER_CONFIG: Record<LessonGender, { label: string; icon: LucideIcon; activeBg: string; activeShadow: string }> = {
  MALE:   { label: 'בנים',   icon: User,  activeBg: 'bg-blue-600',   activeShadow: 'shadow-[0_0_16px_rgba(37,99,235,0.50)]'   },
  FEMALE: { label: 'בנות',   icon: User,  activeBg: 'bg-pink-500',   activeShadow: 'shadow-[0_0_16px_rgba(236,72,153,0.50)]'  },
  MIXED:  { label: 'מעורב',  icon: Users, activeBg: 'bg-violet-600', activeShadow: 'shadow-[0_0_16px_rgba(124,58,237,0.50)]'  },
};

// ─── Age Config ───────────────────────────────────────────────────────────

const AGE_CONFIG: Record<AgeGroup, { label: string; sub: string; activeBg: string; activeShadow: string }> = {
  middle: { label: "חטב\"מ", sub: "ז'–ט'",   activeBg: 'bg-cyan-600',   activeShadow: 'shadow-[0_0_16px_rgba(8,145,178,0.50)]'  },
  high:   { label: "חטב\"ע", sub: "י'–י\"ב", activeBg: 'bg-indigo-600', activeShadow: 'shadow-[0_0_16px_rgba(79,70,229,0.50)]'  },
};

// ─── Exercise Icon Map ────────────────────────────────────────────────────

const EXERCISE_ICONS: Record<string, LucideIcon> = {
  w1: Activity, w2: RotateCcw, w3: Zap,      w4: Flame,    w5: Wind,
  w6: Layers,   m1: Star,      m2: Activity,  m3: Dumbbell, m4: Wind,
  m5: Target,   m6: Zap,       m7: Layers,    m8: Star,     m9: Dumbbell,
  m10: Dumbbell, m11: Wind,    m12: Flame,    c1: Heart,    c2: Wind,
  c3: Heart,    c4: Wind,      c5: Heart,
};

// ─── Exercise Bank ──────────────────────────────────────────────────────────

const EXERCISE_BANK: Exercise[] = [
  // ── Warmup ─────────────────────────────────────────────────────────────
  {
    id: 'w1', phase: 'warmup', goal: 'all', minDifficulty: 'easy',
    nameHe: 'ריצה קלה', duration: '4 דקות',
    instructions: ['ריצה קלה בקצב נוח סביב המגרש', 'שמרו על נשימה סדירה', 'הגיעו ל-60% מהדופק המרבי'],
  },
  {
    id: 'w2', phase: 'warmup', goal: 'all', minDifficulty: 'easy',
    nameHe: 'מתיחות דינמיות', duration: '3 דקות',
    instructions: ['חימום מפרקים: קרסוליים, ברכיים, ירכיים', 'סיבובי ידיים קדימה ואחורה', 'כפיפות צוואר עדינות'],
  },
  {
    id: 'w3', phase: 'warmup', goal: 'all', minDifficulty: 'easy',
    nameHe: 'קפיצות ג׳ק', duration: '2 דקות', reps: '3 × 20',
    instructions: ['עמדת פתיחה: רגליים צמודות, ידיים לצדדים', 'קפצו והרחיקו רגליים תוך הרמת ידיים', 'חזרו לעמדת פתיחה', 'קצב מהיר ואחיד'],
  },
  {
    id: 'w4', phase: 'warmup', goal: 'HIIT עצימות גבוהה', minDifficulty: 'medium',
    nameHe: 'ריצת מקום עצימה', duration: '90 שניות', reps: '3 × 30 שניות',
    instructions: ['ריצה במקום בקצב מהיר', 'הרימו ברכיים לגובה האגן', '30 שניות ריצה + 15 שניות מנוחה', 'שמרו על גב ישר'],
  },
  {
    id: 'w5', phase: 'warmup', goal: 'גמישות ורגיעה', minDifficulty: 'easy',
    nameHe: 'קמיצת שמש', duration: '5 דקות',
    instructions: ['קמיצת שמש פשוטה x3', 'נשימה עמוקה בכל תנוחה', 'שחרור מלא של כתפיים ועמוד שדרה'],
  },
  {
    id: 'w6', phase: 'warmup', goal: 'כוח ליבה', minDifficulty: 'medium',
    nameHe: 'אקטיבציית ליבה', duration: '3 דקות',
    instructions: ['שכבו על הגב, ברכיים כפופות', 'הדקו בטן ושמרו 5 שניות × 10', 'Dead bug: הרחיקו רגל-יד הפוכה × 3 × 8'],
  },

  // ── Main ────────────────────────────────────────────────────────────────
  {
    id: 'm1', phase: 'main', goal: 'כושר כללי', minDifficulty: 'medium',
    nameHe: 'מעגל כושר', duration: '20 דקות', reps: '3 מעגלים',
    instructions: ['שכיבות סמיכה × 15', 'קפיצות לסקוואט × 12', 'פלאנק 30 שניות', 'ריצה סביב המגרש', 'מנוחה 90 שניות בין מעגלים'],
  },
  {
    id: 'm2', phase: 'main', goal: 'אירובי', minDifficulty: 'medium',
    nameHe: 'ריצת אינטרוולים', duration: '18 דקות',
    instructions: ['חממו 2 דקות בריצה קלה', '6 × ריצת מהירות 200 מטר', 'מנוחה 60 שניות בין ריצות'],
  },
  {
    id: 'm3', phase: 'main', goal: 'כוח ועמידות', minDifficulty: 'medium',
    nameHe: 'תרגילי עמידות', duration: '20 דקות', reps: '4 × 12',
    instructions: ['סקוואט × 12', 'לאנג׳ קדימה × 10 לכל רגל', 'שכיבות סמיכה רחבות × 12', 'מנוחה 60 שניות'],
  },
  {
    id: 'm4', phase: 'main', goal: 'שיפור גמישות', minDifficulty: 'easy',
    nameHe: 'מתיחות שרירים', duration: '18 דקות',
    instructions: ['מתיחת ירך קדמית 30 שניות × כל צד', 'מתיחת חזה ופתיחת כתפיים', 'פרפר: כפות רגליים נגועות 60 שניות'],
  },
  {
    id: 'm5', phase: 'main', goal: 'מיומנויות כדור', minDifficulty: 'easy',
    nameHe: 'תרגול קליעה לסל', duration: '20 דקות',
    instructions: ['תרגול ירייה ממרחק 3 מ׳ × 10', 'קליעה בתנועה: תפוס+ירי', 'תחרות: מי מגיע ל-5 קליעות ראשון'],
  },
  {
    id: 'm6', phase: 'main', goal: 'HIIT עצימות גבוהה', minDifficulty: 'hard',
    nameHe: 'טאבאטה קלאסי', duration: '20 דקות',
    instructions: ['8 × 20 שניות עבודה + 10 שניות מנוחה', 'בארפי / קפיצות לסקוואט / ריצת מקום / Mountain climbers', '2 מעגלים, מנוחה 2 דקות ביניהם'],
  },
  {
    id: 'm7', phase: 'main', goal: 'כוח ליבה', minDifficulty: 'medium',
    nameHe: 'סדרת ליבה מתקדמת', duration: '18 דקות', reps: '3 × 12',
    instructions: ['פלאנק קדמי 45 שניות', 'Side plank 30 שניות × כל צד', 'Russian twist × 20', 'Bird-dog × 12 לכל צד'],
  },
  {
    id: 'm8', phase: 'main', goal: 'עבודת תחנות', minDifficulty: 'hard',
    nameHe: 'מעגל 6 תחנות', duration: '24 דקות',
    instructions: ['שכיבות סמיכה / קפיצה לגובה / בארפי / פלאנק / ריצת מעבורת', '45 שניות בכל תחנה, 15 שניות מעבר', '2 מעגלים עם מנוחה 2 דקות ביניהם'],
  },
  {
    id: 'm9', phase: 'main', goal: 'כוח ושרירים', minDifficulty: 'medium',
    nameHe: 'כוח פלג עליון', duration: '20 דקות', reps: '4 × 10',
    instructions: ['שכיבות סמיכה רגילות × 10', 'שכיבות סמיכה צרות × 10', 'Pike push-up × 8', 'Dips על ספסל × 10'],
  },
  {
    id: 'm10', phase: 'main', goal: 'כוח ושרירים', minDifficulty: 'medium',
    nameHe: 'כוח פלג תחתון', duration: '20 דקות', reps: '4 × 10',
    instructions: ['סקוואט עמוק × 12', 'לאנג׳ הפוך × 10 לכל רגל', 'Glute bridge × 15', 'Wall sit 45 שניות'],
  },
  {
    id: 'm11', phase: 'main', goal: 'גמישות ורגיעה', minDifficulty: 'easy',
    nameHe: 'יוגה שרירים ונשימה', duration: '20 דקות',
    instructions: ['Warrior I & II — 30 שניות כל צד', 'Downward dog — 45 שניות', 'Pigeon pose — 60 שניות כל צד', 'נשימת קופסה'],
  },
  {
    id: 'm12', phase: 'main', goal: 'HIIT עצימות גבוהה', minDifficulty: 'hard',
    nameHe: 'ספרינט אינטרוולים', duration: '16 דקות',
    instructions: ['6 × ספרינט 60 מ׳ בעצימות מרבית', 'הליכה חזרה = מנוחה (45–60 שניות)', 'רשמו זמן לכל ספרינט'],
  },

  // ── Cooldown ────────────────────────────────────────────────────────────
  {
    id: 'c1', phase: 'cooldown', goal: 'all', minDifficulty: 'easy',
    nameHe: 'הליכה והרפיה', duration: '3 דקות',
    instructions: ['הליכה נוחה להאטת הדופק', 'נשימות עמוקות: 4 שניות פנימה, 6 החוצה', 'שחררו מתח מהכתפיים'],
  },
  {
    id: 'c2', phase: 'cooldown', goal: 'all', minDifficulty: 'easy',
    nameHe: 'מתיחות סטטיות', duration: '5 דקות',
    instructions: ['מתיחת חלציים 30 שניות × כל צד', 'מתיחת ירך אחורית 30 שניות', 'מתיחת כתפיים ודו-ראשי 30 שניות'],
  },
  {
    id: 'c3', phase: 'cooldown', goal: 'all', minDifficulty: 'easy',
    nameHe: 'נשימה ומיינדפולנס', duration: '2 דקות',
    instructions: ['שבו במעגל בנוח', 'עיניים עצומות, נשימה עמוקה', 'הכירו בהישג השיעור'],
  },
  {
    id: 'c4', phase: 'cooldown', goal: 'HIIT עצימות גבוהה', minDifficulty: 'medium',
    nameHe: 'שחרור לאחר HIIT', duration: '6 דקות',
    instructions: ['הליכה 2 דקות להאטה הדרגתית', 'מתיחת ירכיים קדמיות 45 שניות × כל צד', 'Forward fold עמוד 60 שניות'],
  },
  {
    id: 'c5', phase: 'cooldown', goal: 'גמישות ורגיעה', minDifficulty: 'easy',
    nameHe: 'Savasana קצר', duration: '5 דקות',
    instructions: ['שכבו על הגב, גוף רפוי', 'עיניים עצומות, נשימה טבעית', 'סריקת גוף מנטלית מרגליים לראש'],
  },
];

// ─── Difficulty helpers ───────────────────────────────────────────────────

const DIFF_LEVEL: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

// ─── Generate lesson ────────────────────────────────────────────────────────

function generateLesson(goal: GoalType, difficulty: Difficulty): LessonStep[] {
  const maxLevel = DIFF_LEVEL[difficulty];

  const pick = (phase: Phase, count: number): Exercise[] => {
    const pool = EXERCISE_BANK.filter(
      (e) => e.phase === phase
        && DIFF_LEVEL[e.minDifficulty] <= maxLevel
        && (e.goal === goal || e.goal === 'all'),
    );
    const fallback = EXERCISE_BANK.filter(
      (e) => e.phase === phase && DIFF_LEVEL[e.minDifficulty] <= maxLevel && e.goal === 'all',
    );
    const source = pool.length >= count
      ? pool
      : [...pool, ...fallback.filter((f) => !pool.find((p) => p.id === f.id))];
    return [...source].sort(() => Math.random() - 0.5).slice(0, Math.min(count, source.length));
  };

  return [
    ...pick('warmup', 2),
    ...pick('main', 4),
    ...pick('cooldown', 2),
  ].map((e) => ({ ...e, done: false, expanded: false }));
}

// ─── Animation variants ───────────────────────────────────────────────────

const STAGGER_CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const CARD_VARIANT = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, damping: 18, stiffness: 260 },
  },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function FlameIcons({ count, small = false }: { count: number; small?: boolean }): React.JSX.Element {
  return (
    <span className="flex">
      {Array.from({ length: count }).map((_, i) => (
        <Flame
          key={i}
          className={small ? 'h-3 w-3' : 'h-4 w-4'}
          style={{ opacity: 1 - i * 0.1 }}
        />
      ))}
    </span>
  );
}

function PillSelector<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; icon?: LucideIcon; sub?: string; activeBg: string; activeShadow: string }[];
  value: T;
  onChange: (v: T) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); }}
            whileTap={{ scale: 0.94 }}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all ${
              active
                ? `${opt.activeBg} border-transparent text-white ${opt.activeShadow}`
                : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white'
            }`}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span>{opt.label}</span>
            {opt.sub && <span className={`text-[10px] font-normal ${active ? 'text-white/75' : 'text-slate-400'}`}>{opt.sub}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

function DifficultySelector({
  value, onChange,
}: {
  value: Difficulty;
  onChange: (v: Difficulty) => void;
}): React.JSX.Element {
  const options = (['easy', 'medium', 'hard'] as Difficulty[]);
  return (
    <div className="flex gap-2">
      {options.map((d) => {
        const cfg = DIFFICULTY_CONFIG[d];
        const active = d === value;
        return (
          <motion.button
            key={d}
            type="button"
            onClick={() => { onChange(d); }}
            whileTap={{ scale: 0.93 }}
            className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-center transition-all ${
              active
                ? `${cfg.activeBg} border-transparent text-white ${cfg.activeShadow}`
                : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
            }`}
          >
            <FlameIcons count={cfg.flameCount} />
            <span className="text-sm font-bold">{cfg.label}</span>
            <span className={`text-[10px] ${active ? 'text-white/75' : 'text-slate-400'}`}>{cfg.subtitle}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function GoalRow({
  value, onChange,
}: {
  value: GoalType;
  onChange: (v: GoalType) => void;
}): React.JSX.Element {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
      {GOALS.map((goal) => {
        const cfg = GOAL_CONFIG[goal];
        const Icon = cfg.icon;
        const active = goal === value;
        return (
          <motion.button
            key={goal}
            type="button"
            onClick={() => { onChange(goal); }}
            whileTap={{ scale: 0.93 }}
            className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm font-bold transition-all ${
              active
                ? `${cfg.activeBg} border-transparent text-white ${cfg.activeShadow}`
                : 'border-slate-200 bg-white/70 text-slate-600 hover:border-indigo-200 hover:text-indigo-700'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {goal}
          </motion.button>
        );
      })}
    </div>
  );
}

function LessonProgressBar({ done, total }: { done: number; total: number }): React.JSX.Element {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/80">
        <motion.div
          className="h-full rounded-full bg-gradient-to-e from-indigo-500 to-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="min-w-[4rem] text-end text-sm font-bold text-slate-600">{done}/{total}</span>
    </div>
  );
}

function ExerciseCard({
  step,
  onToggleDone,
  onToggleExpand,
}: {
  step: LessonStep;
  onToggleDone: () => void;
  onToggleExpand: () => void;
}): React.JSX.Element {
  const phase = PHASE_CONFIG[step.phase];
  const Icon = EXERCISE_ICONS[step.id] ?? Activity;

  return (
    <motion.div
      variants={CARD_VARIANT}
      layout
      className={`overflow-hidden rounded-2xl border-s-4 ${phase.accentBorder} border border-e-0 border-t-0 border-b-0 bg-white/90 backdrop-blur-md ${phase.glow} transition-all ${step.done ? 'opacity-55' : ''}`}
      style={{ borderWidth: '1px', borderStartWidth: '4px' }}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Phase-colored icon */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${phase.iconBg}`}>
          <Icon className={`h-5 w-5 ${phase.iconColor}`} aria-hidden="true" />
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <p className={`font-bold leading-tight text-slate-900 ${step.done ? 'line-through text-slate-400' : ''}`}>
            {step.nameHe}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={`text-sm font-semibold ${phase.text}`}>{step.duration}</span>
            {step.reps && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-sm text-slate-500">{step.reps}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={step.expanded ? 'כווץ' : 'הרחב'}
          >
            {step.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <motion.button
            type="button"
            onClick={onToggleDone}
            whileTap={{ scale: 0.85 }}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              step.done ? `${phase.iconBg} ${phase.iconColor}` : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'
            }`}
            aria-label={step.done ? 'בטל סימון' : 'סמן כהושלם'}
          >
            <CheckCircle2 className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Expandable instructions */}
      <AnimatePresence initial={false}>
        {step.expanded && (
          <motion.div
            key="inst"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <ol className={`space-y-2 border-t ${phase.cardBorder} px-5 py-4`}>
              {step.instructions.map((inst, idx) => (
                <li key={idx} className="flex gap-2.5 text-sm">
                  <span
                    className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${phase.progressBar}`}
                    style={{ minWidth: '1.125rem', minHeight: '1.125rem', width: '1.125rem', height: '1.125rem' }}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-slate-700">{inst}</span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PhaseSection({
  phase, steps, onToggleDone, onToggleExpand,
}: {
  phase: Phase;
  steps: LessonStep[];
  onToggleDone: (id: string) => void;
  onToggleExpand: (id: string) => void;
}): React.JSX.Element | null {
  if (steps.length === 0) return null;
  const cfg = PHASE_CONFIG[phase];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div>
      {/* Phase banner */}
      <div
        className={`mb-3 flex items-center justify-between rounded-2xl bg-gradient-to-br ${cfg.gradient} px-5 py-3.5 ${cfg.headerGlow}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">{cfg.emoji}</span>
          <div>
            <p className="text-base font-extrabold text-white">{cfg.label}</p>
            <p className="text-xs text-white/70">{steps.length} תרגילים</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/30">
            <motion.div
              className="h-full rounded-full bg-white"
              animate={{ width: `${steps.length === 0 ? 0 : Math.round((doneCount / steps.length) * 100)}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="text-xs font-bold text-white/90">{doneCount}/{steps.length}</span>
        </div>
      </div>

      {/* Cards */}
      <motion.div
        className="space-y-2.5"
        variants={STAGGER_CONTAINER}
        initial="hidden"
        animate="show"
      >
        {steps.map((step) => (
          <ExerciseCard
            key={step.id}
            step={step}
            onToggleDone={() => { onToggleDone(step.id); }}
            onToggleExpand={() => { onToggleExpand(step.id); }}
          />
        ))}
      </motion.div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

const GENDER_OPTIONS = (['MALE', 'FEMALE', 'MIXED'] as LessonGender[]).map((v) => ({
  value: v,
  label: GENDER_CONFIG[v].label,
  icon: GENDER_CONFIG[v].icon,
  activeBg: GENDER_CONFIG[v].activeBg,
  activeShadow: GENDER_CONFIG[v].activeShadow,
}));

const AGE_OPTIONS = (['middle', 'high'] as AgeGroup[]).map((v) => ({
  value: v,
  label: AGE_CONFIG[v].label,
  sub: AGE_CONFIG[v].sub,
  activeBg: AGE_CONFIG[v].activeBg,
  activeShadow: AGE_CONFIG[v].activeShadow,
}));

export default function ExerciseBankPage(): React.JSX.Element {
  const [goal, setGoal]           = useState<GoalType>('כושר כללי');
  const [gender, setGender]       = useState<LessonGender>('MIXED');
  const [ageGroup, setAgeGroup]   = useState<AgeGroup>('high');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [lesson, setLesson]       = useState<LessonStep[]>(() => generateLesson('כושר כללי', 'medium'));
  const [animKey, setAnimKey]     = useState(0);

  const doneCount     = lesson.filter((s) => s.done).length;
  const warmupSteps   = lesson.filter((s) => s.phase === 'warmup');
  const mainSteps     = lesson.filter((s) => s.phase === 'main');
  const cooldownSteps = lesson.filter((s) => s.phase === 'cooldown');

  const handleGenerate = (): void => {
    setLesson(generateLesson(goal, difficulty));
    setAnimKey((k) => k + 1);
  };

  const handleToggleDone = (id: string): void => {
    setLesson((prev) => prev.map((s) => s.id === id ? { ...s, done: !s.done } : s));
  };

  const handleToggleExpand = (id: string): void => {
    setLesson((prev) => prev.map((s) => s.id === id ? { ...s, expanded: !s.expanded } : s));
  };

  const handleReset = (): void => {
    setLesson((prev) => prev.map((s) => ({ ...s, done: false, expanded: false })));
  };

  const diffCfg = DIFFICULTY_CONFIG[difficulty];

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-16">

      {/* ── Page hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-6 py-6 shadow-[0_10px_40px_rgba(99,102,241,0.45)]">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-8 -end-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 start-8 h-24 w-24 rounded-full bg-violet-400/20 blur-xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white">מחולל שיעור חכם</h1>
            <p className="mt-1 text-sm text-white/70">הגדר את הפרמטרים ולחץ לקבלת שיעור מותאם</p>
          </div>
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm"
          >
            ⚽
          </motion.div>
        </div>
      </div>

      {/* ── Control Panel ──────────────────────────────────────────────────── */}
      <div className="space-y-4 rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl">

        {/* Row 1: Gender + Age */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">מגדר</label>
            <PillSelector options={GENDER_OPTIONS} value={gender} onChange={setGender} />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">שכבת גיל</label>
            <PillSelector options={AGE_OPTIONS} value={ageGroup} onChange={setAgeGroup} />
          </div>
        </div>

        {/* Row 2: Difficulty */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">רמת קושי</label>
          <DifficultySelector value={difficulty} onChange={setDifficulty} />
        </div>

        {/* Row 3: Goal */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">מטרת האימון</label>
          <GoalRow value={goal} onChange={setGoal} />
        </div>
      </div>

      {/* ── Generate button ────────────────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={handleGenerate}
        whileHover={{ scale: 1.015, y: -2 }}
        whileTap={{ scale: 0.97 }}
        className={`flex w-full items-center justify-center gap-3 rounded-3xl ${diffCfg.activeBg} py-4 text-lg font-extrabold text-white ${diffCfg.activeShadow} transition-shadow`}
      >
        <Sparkles className="h-5 w-5" />
        צור שיעור חדש
        <span className="flex items-center gap-0.5 opacity-80">
          <FlameIcons count={diffCfg.flameCount} small />
        </span>
        <RefreshCw className="ms-1 h-4 w-4 opacity-60" />
      </motion.button>

      {/* ── Progress + reset ───────────────────────────────────────────────── */}
      {lesson.length > 0 && (
        <div className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/70 px-5 py-3.5 shadow-sm backdrop-blur-xl">
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">התקדמות השיעור</span>
              <span className="text-xs text-slate-400">
                {doneCount === lesson.length ? '🎉 הושלם!' : `${lesson.length - doneCount} נותרו`}
              </span>
            </div>
            <LessonProgressBar done={doneCount} total={lesson.length} />
          </div>
          {doneCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              איפוס
            </button>
          )}
        </div>
      )}

      {/* ── Lesson timeline ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={animKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <PhaseSection phase="warmup"   steps={warmupSteps}   onToggleDone={handleToggleDone} onToggleExpand={handleToggleExpand} />
          <PhaseSection phase="main"     steps={mainSteps}     onToggleDone={handleToggleDone} onToggleExpand={handleToggleExpand} />
          <PhaseSection phase="cooldown" steps={cooldownSteps} onToggleDone={handleToggleDone} onToggleExpand={handleToggleExpand} />
        </motion.div>
      </AnimatePresence>

      {/* ── Lesson metadata badge ─────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-2 pt-2 text-xs text-slate-400">
        <span className="rounded-full border border-slate-200 bg-white/60 px-3 py-1 font-medium">
          {GENDER_CONFIG[gender].label}
        </span>
        <span className="rounded-full border border-slate-200 bg-white/60 px-3 py-1 font-medium">
          {AGE_CONFIG[ageGroup].label} {AGE_CONFIG[ageGroup].sub}
        </span>
        <span className="rounded-full border border-slate-200 bg-white/60 px-3 py-1 font-medium">
          רמת {diffCfg.label}
        </span>
        <span className="rounded-full border border-slate-200 bg-white/60 px-3 py-1 font-medium">
          {goal}
        </span>
      </div>
    </div>
  );
}
