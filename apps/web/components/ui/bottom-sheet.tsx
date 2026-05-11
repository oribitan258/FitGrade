'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps): React.JSX.Element {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-white shadow-2xl',
              'max-h-[90vh]',
              className,
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.8 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) {
                onClose();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* Drag handle */}
            <div className="flex shrink-0 cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing">
              <div className="h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
            </div>

            {title != null && (
              <div className="shrink-0 border-b border-slate-100 px-6 pb-4 pt-2">
                <h2 className="text-center text-lg font-bold text-slate-900">{title}</h2>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {children}
            </div>

            {/* Safe area spacer */}
            <div className="shrink-0" style={{ height: 'max(env(safe-area-inset-bottom), 12px)' }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
