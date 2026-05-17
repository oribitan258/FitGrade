'use client';

/**
 * WeightSlider — linked dual-slider for fitness vs. conduct weight split.
 *
 * Moving the fitness slider automatically adjusts conduct (and vice-versa)
 * so they always sum to 100. Renders two coloured tracks side-by-side with
 * live percentage labels and a visual "split bar".
 */

import { useCallback } from 'react';
import { cn } from '@/lib/utils';

interface WeightSliderProps {
  fitnessWeight: number;   // 0–100
  conductWeight: number;   // 0–100  (should equal 100 - fitnessWeight)
  onChange: (fitnessWeight: number, conductWeight: number) => void;
  disabled?: boolean;
  className?: string;
}

export function WeightSlider({
  fitnessWeight,
  conductWeight,
  onChange,
  disabled = false,
  className,
}: WeightSliderProps): React.JSX.Element {
  const handleFitnessChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Math.min(100, Math.max(0, Number(e.target.value)));
      onChange(val, 100 - val);
    },
    [onChange],
  );

  const handleConductChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Math.min(100, Math.max(0, Number(e.target.value)));
      onChange(100 - val, val);
    },
    [onChange],
  );

  return (
    <div className={cn('space-y-6', className)} dir="rtl">
      {/* Split bar — visual representation */}
      <div className="relative h-10 overflow-hidden rounded-2xl shadow-inner">
        {/* Fitness (right side in RTL) */}
        <div
          className="absolute inset-y-0 start-0 flex items-center justify-center bg-gradient-to-e from-indigo-500 to-indigo-400 transition-[width] duration-150"
          style={{ width: `${fitnessWeight}%` }}
        >
          {fitnessWeight >= 12 && (
            <span className="select-none text-xs font-bold text-white drop-shadow">
              {fitnessWeight}%
            </span>
          )}
        </div>
        {/* Conduct (left side in RTL) */}
        <div
          className="absolute inset-y-0 end-0 flex items-center justify-center bg-gradient-to-s from-violet-500 to-violet-400 transition-[width] duration-150"
          style={{ width: `${conductWeight}%` }}
        >
          {conductWeight >= 12 && (
            <span className="select-none text-xs font-bold text-white drop-shadow">
              {conductWeight}%
            </span>
          )}
        </div>
        {/* Divider line */}
        <div
          className="absolute inset-y-0 w-0.5 bg-white/60 transition-[left] duration-150"
          style={{ insetInlineStart: `${fitnessWeight}%` }}
        />
      </div>

      {/* Fitness slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <label className="font-semibold text-indigo-700">כושר גופני</label>
          <span className="tabular-nums font-bold text-indigo-800">{fitnessWeight}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={fitnessWeight}
          onChange={handleFitnessChange}
          disabled={disabled}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full bg-indigo-100',
            'accent-indigo-500',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          style={{ direction: 'ltr' }}
          aria-label="אחוז משקל כושר גופני"
        />
      </div>

      {/* Conduct slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <label className="font-semibold text-violet-700">תלמידות</label>
          <span className="tabular-nums font-bold text-violet-800">{conductWeight}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={conductWeight}
          onChange={handleConductChange}
          disabled={disabled}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full bg-violet-100',
            'accent-violet-500',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          style={{ direction: 'ltr' }}
          aria-label="אחוז משקל תלמידות"
        />
      </div>

      {/* Sum indicator */}
      <p className="text-center text-xs text-slate-500">
        סה״כ:{' '}
        <span
          className={cn(
            'font-bold',
            fitnessWeight + conductWeight === 100 ? 'text-emerald-600' : 'text-red-500',
          )}
        >
          {fitnessWeight + conductWeight}%
        </span>
        {fitnessWeight + conductWeight !== 100 && ' — חייב להיות 100%'}
      </p>
    </div>
  );
}
