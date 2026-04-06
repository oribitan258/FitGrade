'use client';

/**
 * Categorized + searchable test-type picker.
 *
 * Renders as an inline panel (not a Popover) so it fits naturally inside the
 * existing CreateSessionModal. Tabs filter by TestCategory; the search box
 * narrows by Hebrew name. A grade-level badge ("מומלץ" / age hint) appears
 * when the parent class's gradeLevel is known.
 */

import { useMemo, useState } from 'react';
import { GlowingSearch } from '@/components/ui/glowing-search';
import { cn } from '@/lib/utils';
import type { TestType } from '@/hooks/use-test-types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = TestType['category'];

// ─── Hebrew labels ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<Category, string> = {
  ENDURANCE:     'סיבולת',
  STRENGTH:      'כוח',
  SPEED_AGILITY: 'מהירות וזריזות',
  FLEXIBILITY:   'גמישות',
};

/** Ordered display sequence for the category tabs. */
const CATEGORY_ORDER: Category[] = [
  'ENDURANCE',
  'STRENGTH',
  'SPEED_AGILITY',
  'FLEXIBILITY',
];

// ─── Badge helpers ────────────────────────────────────────────────────────────

type BadgeKind = 'recommended' | 'too_old' | 'too_young' | 'none';

function getBadgeKind(
  test: TestType,
  gradeLevel: number | null | undefined,
): BadgeKind {
  if (!gradeLevel || test.minGrade === null || test.maxGrade === null) {
    return 'none';
  }
  if (gradeLevel >= test.minGrade && gradeLevel <= test.maxGrade) {
    return 'recommended';
  }
  if (gradeLevel < test.minGrade) return 'too_old';
  return 'too_young';
}

function GradeBadge({ kind }: { kind: BadgeKind }): React.JSX.Element | null {
  if (kind === 'none') return null;

  if (kind === 'recommended') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/70 shrink-0">
        מומלץ
      </span>
    );
  }

  const label = kind === 'too_old' ? 'לגיל מבוגר יותר' : 'לגיל צעיר יותר';
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200/70 shrink-0">
      {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface TestTypePickerProps {
  testTypes: TestType[];
  value: string;
  onChange: (id: string) => void;
  /** Pass class.gradeLevel so the picker can show recommended/age badges. */
  gradeLevel?: number | null;
  disabled?: boolean;
}

export function TestTypePicker({
  testTypes,
  value,
  onChange,
  gradeLevel,
  disabled = false,
}: TestTypePickerProps): React.JSX.Element {
  const [search, setSearch]             = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'ALL'>('ALL');

  // Categories that actually have tests (avoids empty tabs)
  const presentCategories = useMemo(
    () => CATEGORY_ORDER.filter((c) => testTypes.some((t) => t.category === c)),
    [testTypes],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return testTypes.filter((t) => {
      const matchesSearch = q === '' || t.nameHe.toLowerCase().includes(q);
      const matchesCategory = activeCategory === 'ALL' || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [testTypes, search, activeCategory]);

  // Group filtered tests by category in display order
  const groups = useMemo(() => {
    const cats = activeCategory === 'ALL' ? CATEGORY_ORDER : [activeCategory];
    return cats
      .map((cat) => ({
        category: cat,
        tests: filtered.filter((t) => t.category === cat),
      }))
      .filter((g) => g.tests.length > 0);
  }, [filtered, activeCategory]);

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'pointer-events-none opacity-50')}>

      {/* Search */}
      <GlowingSearch
        value={search}
        onChange={setSearch}
        placeholder="חיפוש מבחן..."
        aria-label="חיפוש סוג מבחן"
      />

      {/* Category tabs */}
      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="קטגוריית מבחן"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'ALL'}
          onClick={() => setActiveCategory('ALL')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            activeCategory === 'ALL'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          הכל
        </button>
        {presentCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              activeCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Test list */}
      <div
        className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm"
        role="listbox"
        aria-label="רשימת מבחנים"
      >
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">לא נמצאו מבחנים</p>
        ) : (
          groups.map(({ category, tests }) => (
            <div key={category}>
              {/* Category heading — only shown in ALL view */}
              {activeCategory === 'ALL' && (
                <div className="sticky top-0 bg-slate-50/95 backdrop-blur-sm px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  {CATEGORY_LABELS[category]}
                </div>
              )}

              {tests.map((test) => {
                const isSelected = test.id === value;
                const badgeKind  = getBadgeKind(test, gradeLevel);

                return (
                  <button
                    key={test.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onChange(test.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-start text-sm transition-colors border-b border-slate-100/80 last:border-0',
                      isSelected
                        ? 'bg-indigo-50 text-indigo-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <span className="flex-1 leading-snug">
                      {test.nameHe}
                      {test.unit && (
                        <span className="ms-1 text-xs font-normal text-slate-400">
                          ({test.unit})
                        </span>
                      )}
                    </span>
                    <GradeBadge kind={badgeKind} />
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
