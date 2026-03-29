import { cn } from '@/lib/utils';

interface SemesterPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A content card/panel whose border color responds to the active semester.
 * Requires data-semester="A"|"B" on a parent element (set by the teacher layout root).
 * Uses --semester-border CSS custom property defined in globals.css.
 *
 * Usage: replace plain white card <div>s with <SemesterPanel> to get
 * automatic violet (A) / emerald (B) border transitions at zero cost.
 */
export function SemesterPanel({ children, className, style }: SemesterPanelProps): React.JSX.Element {
  return (
    <div
      style={style}
      className={cn(
        'rounded-2xl bg-white/80 border backdrop-blur-sm',
        'border-[var(--semester-border,rgba(139,92,246,0.20))]',
        'transition-[border-color] duration-700 ease-in-out',
        className,
      )}
    >
      {children}
    </div>
  );
}
