import { formatRawValue } from '../utils';

describe('formatRawValue', () => {
  // ── TIME ────────────────────────────────────────────────────────────────────

  it('TIME 445s → "7:25"', () => {
    expect(formatRawValue(445, 'TIME')).toBe('7:25');
  });

  it('TIME 60s → "1:00" (zero-padded seconds)', () => {
    expect(formatRawValue(60, 'TIME')).toBe('1:00');
  });

  it('TIME 61s → "1:01" (not "1:1")', () => {
    expect(formatRawValue(61, 'TIME')).toBe('1:01');
  });

  it('TIME 0s → "0:00"', () => {
    expect(formatRawValue(0, 'TIME')).toBe('0:00');
  });

  it('TIME 3599s → "59:59"', () => {
    expect(formatRawValue(3599, 'TIME')).toBe('59:59');
  });

  it('TIME 30.7s rounds to 31 → "0:31"', () => {
    expect(formatRawValue(30.7, 'TIME')).toBe('0:31');
  });

  // ── REPS ────────────────────────────────────────────────────────────────────

  it('REPS 33 → "33"', () => {
    expect(formatRawValue(33, 'REPS')).toBe('33');
  });

  it('REPS 33.7 rounds to 34 → "34"', () => {
    expect(formatRawValue(33.7, 'REPS')).toBe('34');
  });

  it('REPS 0 → "0"', () => {
    expect(formatRawValue(0, 'REPS')).toBe('0');
  });

  // ── PASS_FAIL ────────────────────────────────────────────────────────────────

  it('PASS_FAIL always returns null (no raw label)', () => {
    expect(formatRawValue(1, 'PASS_FAIL')).toBeNull();
    expect(formatRawValue(0, 'PASS_FAIL')).toBeNull();
  });

  // ── GENERAL (and any unknown type) ───────────────────────────────────────────

  it('GENERAL 8.5 → "8.5"', () => {
    expect(formatRawValue(8.5, 'GENERAL')).toBe('8.5');
  });

  it('GENERAL 8 → "8.0" (always one decimal)', () => {
    expect(formatRawValue(8, 'GENERAL')).toBe('8.0');
  });

  it('unknown type falls through to one-decimal format', () => {
    expect(formatRawValue(5.123, 'DISTANCE')).toBe('5.1');
  });
});
