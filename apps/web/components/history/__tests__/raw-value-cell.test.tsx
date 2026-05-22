import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RawValueCell } from '../RawValueCell';

// lucide-react icons render as SVG — no mock needed
// framer-motion not used in this component

function makeProps(overrides: Partial<React.ComponentProps<typeof RawValueCell>> = {}) {
  return {
    resultId: 'result-1',
    rawValue: 33,
    inputType: 'REPS',
    unit: null,
    onSave: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('RawValueCell', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── PASS_FAIL ─────────────────────────────────────────────────────────────

  it('PF-1: PASS_FAIL rawValue≥1 renders "עבר", no interactive element', () => {
    render(<RawValueCell {...makeProps({ inputType: 'PASS_FAIL', rawValue: 1 })} />);
    expect(screen.getByText('עבר')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('PF-2: PASS_FAIL rawValue=0 renders "נכשל"', () => {
    render(<RawValueCell {...makeProps({ inputType: 'PASS_FAIL', rawValue: 0 })} />);
    expect(screen.getByText('נכשל')).toBeInTheDocument();
  });

  // ── TIME — idle display ────────────────────────────────────────────────────

  it('TIME-1: idle state renders "7:25" for rawValue=445', () => {
    render(<RawValueCell {...makeProps({ inputType: 'TIME', rawValue: 445 })} />);
    // unit=null so span has text "7:25" exactly
    expect(screen.getByText('7:25')).toBeInTheDocument();
  });

  it('TIME-2: clicking idle button switches to edit mode, input pre-filled with "7:25"', async () => {
    render(<RawValueCell {...makeProps({ inputType: 'TIME', rawValue: 445 })} />);
    await userEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox', { name: /ערך גולמי לעריכה/ });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('7:25');
  });

  it('TIME-3: valid new time "8:00" calls onSave with 480 seconds', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    // rawValue=300 ("5:00"), type a different value "8:00" (480s)
    render(<RawValueCell {...makeProps({ inputType: 'TIME', rawValue: 300, onSave })} />);
    await userEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '8:00');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('result-1', 480));
  });

  it('TIME-4: "1:60" has invalid seconds ≥60 → onSave NOT called, error message shown', async () => {
    const onSave = jest.fn();
    render(<RawValueCell {...makeProps({ inputType: 'TIME', rawValue: 300, onSave })} />);
    await userEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '1:60');
    await userEvent.keyboard('{Enter}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/פורמט/)).toBeInTheDocument();
  });

  it('TIME-5: "abc" is not a valid time → onSave NOT called, error message shown', async () => {
    const onSave = jest.fn();
    render(<RawValueCell {...makeProps({ inputType: 'TIME', rawValue: 300, onSave })} />);
    await userEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    await userEvent.keyboard('{Enter}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/פורמט/)).toBeInTheDocument();
  });

  it('TIME-6: Escape key cancels edit, onSave NOT called, input removed', async () => {
    const onSave = jest.fn();
    render(<RawValueCell {...makeProps({ inputType: 'TIME', rawValue: 300, onSave })} />);
    await userEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    // Fire keyDown directly on the input since setTimeout-based focus hasn't run in jsdom
    await userEvent.type(input, '{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  // ── REPS ──────────────────────────────────────────────────────────────────

  it('REPS-1: idle state shows "33" for rawValue=33', () => {
    render(<RawValueCell {...makeProps({ inputType: 'REPS', rawValue: 33 })} />);
    expect(screen.getByText('33')).toBeInTheDocument();
  });

  it('REPS-2: type "25" and press Enter → onSave called with 25', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<RawValueCell {...makeProps({ inputType: 'REPS', rawValue: 33, onSave })} />);
    await userEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '25');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('result-1', 25));
  });

  it('REPS-3: negative value → onSave NOT called, error shown', async () => {
    const onSave = jest.fn();
    render(<RawValueCell {...makeProps({ inputType: 'REPS', rawValue: 33, onSave })} />);
    await userEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '-5');
    await userEvent.keyboard('{Enter}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/ערך לא תקין/)).toBeInTheDocument();
  });

  it('onSave error → shows error message in button title', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('שגיאת שרת'));
    render(<RawValueCell {...makeProps({ inputType: 'REPS', rawValue: 33, onSave })} />);
    await userEvent.click(screen.getByRole('button'));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, '25');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      const btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('title', 'שגיאת שרת');
    });
  });
});
