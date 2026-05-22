'use client';

import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteResultConfirmDialogProps {
  open: boolean;
  studentName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteResultConfirmDialog({
  open,
  studentName,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteResultConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isDeleting) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מחיקת תוצאה</DialogTitle>
          <DialogDescription>
            האם למחוק את התוצאה של <strong>{studentName}</strong>? פעולה זו אינה ניתנת לשחזור.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            ביטול
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
            {isDeleting ? 'מוחק...' : 'מחק תוצאה'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
