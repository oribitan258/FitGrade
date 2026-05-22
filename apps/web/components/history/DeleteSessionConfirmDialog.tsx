'use client';

import { Loader2, TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteSessionConfirmDialogProps {
  open: boolean;
  resultCount: number;
  studentCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteSessionConfirmDialog({
  open,
  resultCount,
  studentCount,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteSessionConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isDeleting) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <TriangleAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogTitle>מחיקת מבחן</DialogTitle>
          <DialogDescription>
            {resultCount} תוצאות עבור {studentCount} תלמידים &middot; פעולה זו אינה ניתנת לשחזור
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            ביטול
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
            {isDeleting ? 'מוחק...' : 'מחק מבחן'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
