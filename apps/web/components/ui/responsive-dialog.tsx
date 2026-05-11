'use client';

import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BottomSheet } from '@/components/ui/bottom-sheet';

export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders a centered Dialog on desktop (≥768px) and a swipeable BottomSheet
 * on mobile. Drop-in replacement for shadcn Dialog — same props contract.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ResponsiveDialogProps): React.JSX.Element {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className}>
          {(title != null || description != null) && (
            <DialogHeader>
              {title != null && <DialogTitle>{title}</DialogTitle>}
              {description != null && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
          )}
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => { onOpenChange(false); }}
      title={title}
      className={className}
    >
      {description != null && (
        <p className="mb-4 text-center text-sm text-slate-500">{description}</p>
      )}
      {children}
    </BottomSheet>
  );
}
