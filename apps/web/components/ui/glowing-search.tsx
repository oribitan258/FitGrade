'use client';

/**
 * GlowingSearch — RTL-adapted animated glowing search input.
 * Inspired by thanh/animated-glowing-search-bar on 21st.dev.
 *
 * RTL adaptations:
 *  - Search icon sits on the start (right) side via flex row natural RTL order
 *  - Clear button sits on the end (left) side
 *  - `dir="rtl"` on the <input> for correct cursor/caret positioning
 *  - Conic gradient rotation is direction-neutral (centered spin)
 */

import React, { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface GlowingSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
  /** Dark variant — for use inside dark glassmorphic panels (e.g. SprintHeatMode) */
  dark?: boolean;
}

export function GlowingSearch({
  value,
  onChange,
  placeholder = 'חיפוש...',
  className,
  autoFocus,
  'aria-label': ariaLabel,
  dark = false,
}: GlowingSearchProps): React.JSX.Element {
  const inputRef              = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const hasValue              = value.trim().length > 0;
  const active                = focused || hasValue;

  return (
    <>
      {/* Keyframes injected once — scoped to .gs-spin class */}
      <style>{`
        .gs-spin {
          position: absolute;
          width: 600px; height: 600px;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(82deg);
          background-repeat: no-repeat;
          transition: transform 2s ease;
          pointer-events: none;
        }
        .gs-wrapper:hover .gs-spin {
          transform: translate(-50%, -50%) rotate(-98deg);
        }
        .gs-wrapper:focus-within .gs-spin {
          transform: translate(-50%, -50%) rotate(442deg);
          transition: transform 4s ease;
        }
      `}</style>

      <div
        className={cn('gs-wrapper relative w-full', className)}
        role="search"
        aria-label={ariaLabel}
      >
        {/* ── Glow layer 1: strong color ring ─────────────────────────── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[2px] z-0 overflow-hidden rounded-[18px] blur-[4px]"
          style={{ opacity: active ? 1 : 0, transition: 'opacity 0.3s ease' }}
        >
          <div
            className="gs-spin"
            style={{
              background: dark
                ? 'conic-gradient(transparent 0%, #6d28d9 8%, transparent 24%, transparent 50%, #a855f7 60%, transparent 76%)'
                : 'conic-gradient(transparent 0%, #6366f1 8%, transparent 24%, transparent 50%, #8b5cf6 60%, transparent 76%)',
            }}
          />
        </div>

        {/* ── Glow layer 2: soft diffuse halo ──────────────────────────── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[1px] z-0 overflow-hidden rounded-[17px] blur-[2px]"
          style={{ opacity: active ? 0.75 : 0, transition: 'opacity 0.3s ease' }}
        >
          <div
            className="gs-spin"
            style={{
              background: dark
                ? 'conic-gradient(transparent 0%, #4c1d95 5%, transparent 20%, transparent 50%, #7c3aed 58%, transparent 72%)'
                : 'conic-gradient(transparent 0%, #a099d8 6%, transparent 22%, transparent 50%, #dfa2da 58%, transparent 72%)',
            }}
          />
        </div>

        {/* ── Input pill ───────────────────────────────────────────────── */}
        <div
          className="relative z-10 flex h-11 w-full cursor-text items-center gap-2 rounded-2xl border px-3"
          style={{
            background: dark
              ? focused ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)'
              : focused ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.62)',
            backdropFilter:       'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderColor: dark
              ? focused ? 'rgba(139,92,246,0.50)' : 'rgba(255,255,255,0.12)'
              : focused ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.75)',
            boxShadow: active
              ? '0 0 0 3px rgba(99,102,241,0.12), 0 2px 16px rgba(15,23,42,0.08)'
              : '0 2px 12px rgba(15,23,42,0.05)',
            transition: 'background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease',
          }}
          onClick={() => { inputRef.current?.focus(); }}
        >
          {/* Search icon — natural RTL start (right) */}
          <Search
            className="h-4 w-4 shrink-0 transition-colors duration-150"
            style={{ color: focused ? (dark ? '#a78bfa' : '#6366f1') : '#94a3b8' }}
            aria-hidden="true"
          />

          {/* Input */}
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => { onChange(e.target.value); }}
            onFocus={() => { setFocused(true); }}
            onBlur={() => { setFocused(false); }}
            placeholder={placeholder}
            aria-label={ariaLabel ?? placeholder}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            dir="rtl"
            className={cn(
              'min-w-0 flex-1 bg-transparent text-sm font-medium outline-none',
              'placeholder:text-slate-400 transition-colors duration-150',
              dark ? 'text-white placeholder:text-white/35' : (focused ? 'text-slate-800' : 'text-slate-600'),
            )}
          />

          {/* Clear button — natural RTL end (left) */}
          <AnimatePresence>
            {hasValue && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.55 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.55 }}
                transition={{ duration: 0.14, type: 'spring', stiffness: 400, damping: 25 }}
                onClick={(e) => { e.stopPropagation(); onChange(''); inputRef.current?.focus(); }}
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors',
                  dark
                    ? 'bg-white/15 text-white/60 hover:bg-white/25 hover:text-white'
                    : 'bg-slate-200/80 text-slate-500 hover:bg-slate-300/90',
                )}
                aria-label="נקה חיפוש"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
