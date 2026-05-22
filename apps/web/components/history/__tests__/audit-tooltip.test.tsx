import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuditTooltip, EntryLine } from '../AuditTooltip';
import type { AuditTrailEntry } from '@fitgrade/types';

// Radix Tooltip portal content only mounts when the tooltip is open (hover-triggered),
// which is not reliably testable in jsdom. We therefore:
//  - Test the trigger badge via AuditTooltip (always rendered)
//  - Test the EntryLine rendering logic directly (exported for this purpose)

function makeEntry(overrides: Partial<AuditTrailEntry> = {}): AuditTrailEntry {
  return {
    action: 'RESULT_EDIT',
    changedAt: '2026-03-01T10:00:00.000Z',
    oldValue: { rawValue: 30, calculatedGrade: 60 },
    newValue: { rawValue: 40, calculatedGrade: 75 },
    ...overrides,
  };
}

// ─── AuditTooltip trigger badge ────────────────────────────────────────────────

describe('AuditTooltip — trigger badge', () => {
  it('AT-1: renders the orange "עודכן" badge for any non-empty audit trail', () => {
    render(<AuditTooltip auditTrail={[makeEntry()]} inputType="REPS" />);
    expect(screen.getByText('עודכן')).toBeInTheDocument();
  });

  it('AT-1b: badge aria-label includes the edit count', () => {
    render(<AuditTooltip auditTrail={[makeEntry(), makeEntry()]} inputType="REPS" />);
    expect(screen.getByLabelText(/נערך 2 פעמים/)).toBeInTheDocument();
  });
});

// ─── EntryLine — rendered in isolation (avoids Radix portal issues) ──────────

describe('EntryLine — content rendering', () => {
  it('AT-2: RESULT_EDIT wraps old→new in a dir="ltr" span so RTL does not flip the arrow', () => {
    render(<EntryLine entry={makeEntry({ oldValue: { rawValue: 30 }, newValue: { rawValue: 40 } })} inputType="REPS" />);
    const ltrSpan = document.querySelector('span[dir="ltr"]');
    expect(ltrSpan).not.toBeNull();
    expect(ltrSpan?.textContent).toContain('→');
  });

  it('AT-2b: RESULT_EDIT shows formatted old and new values for REPS inputType', () => {
    render(<EntryLine entry={makeEntry({ oldValue: { rawValue: 30 }, newValue: { rawValue: 40 } })} inputType="REPS" />);
    // REPS: formatRawValue(30,'REPS')='30', formatRawValue(40,'REPS')='40'
    expect(screen.getByText(/30.*→.*40/s)).toBeInTheDocument();
  });

  it('AT-3: GRADE_OVERRIDE renders the override grade number', () => {
    render(
      <EntryLine
        entry={makeEntry({ action: 'GRADE_OVERRIDE', oldValue: null, newValue: { gradeOverride: 80 } })}
        inputType="REPS"
      />,
    );
    expect(screen.getByText(/80/)).toBeInTheDocument();
  });

  it('AT-4: GRADE_OVERRIDE with reason — reason text is rendered', () => {
    render(
      <EntryLine
        entry={makeEntry({ action: 'GRADE_OVERRIDE', oldValue: null, newValue: { gradeOverride: 85, overrideReason: 'פציעה' } })}
        inputType="REPS"
      />,
    );
    expect(screen.getByText(/פציעה/)).toBeInTheDocument();
  });

  it('AT-5: GRADE_OVERRIDE without overrideReason — renders grade only, no crash', () => {
    expect(() =>
      render(
        <EntryLine
          entry={makeEntry({ action: 'GRADE_OVERRIDE', oldValue: null, newValue: { gradeOverride: 90 } })}
          inputType="REPS"
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText(/90/)).toBeInTheDocument();
  });

  it('AT-6: RESULT_EDIT for TIME inputType formats both values as M:SS', () => {
    // rawValue=300 → "5:00", rawValue=445 → "7:25"
    render(
      <EntryLine
        entry={makeEntry({ oldValue: { rawValue: 300 }, newValue: { rawValue: 445 } })}
        inputType="TIME"
      />,
    );
    const ltrSpan = document.querySelector('span[dir="ltr"]');
    expect(ltrSpan?.textContent).toContain('5:00');
    expect(ltrSpan?.textContent).toContain('7:25');
  });

  it('AT-7: RESULT_EDIT with missing rawValue falls back to "?"', () => {
    render(
      <EntryLine
        entry={makeEntry({ oldValue: {}, newValue: {} })}
        inputType="REPS"
      />,
    );
    // Both old and new rawValues are undefined → both show "?"
    const ltrSpan = document.querySelector('span[dir="ltr"]');
    expect(ltrSpan?.textContent).toContain('?');
  });
});
