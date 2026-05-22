'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getHebrewGradeLabel } from '@fitgrade/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface GradeOverrideDialogProps {
  open: boolean;
  studentName: string;
  currentOverride: number | null;
  isSubmitting: boolean;
  onConfirm: (grade: number, reason: string) => void;
  onCancel: () => void;
}

export function GradeOverrideDialog({
  open,
  studentName,
  currentOverride,
  isSubmitting,
  onConfirm,
  onCancel,
}: GradeOverrideDialogProps): React.JSX.Element {
  const [grade, setGrade] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ grade?: string }>({});

  // Reset form state each time the dialog opens
  useEffect(() => {
    if (open) {
      setGrade(currentOverride !== null ? String(currentOverride) : '');
      setReason('');
      setErrors({});
    }
  }, [open, currentOverride]);

  function handleSubmit(): void {
    const gradeNum = parseInt(grade, 10);
    const errs: { grade?: string } = {};

    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
      errs.grade = 'ציון חייב להיות מספר שלם בין 0 ל-100';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    onConfirm(gradeNum, reason.trim());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isSubmitting) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עקיפת ציון</DialogTitle>
          <DialogDescription>
            {studentName}
            {currentOverride !== null && (
              <span className="ms-1 text-slate-500">
                &middot; ציון עקיפה נוכחי: {getHebrewGradeLabel(currentOverride)} ({currentOverride})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="override-grade">ציון עקיפה (0–100)</Label>
            <Input
              id="override-grade"
              type="number"
              min={0}
              max={100}
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setErrors((p) => ({ ...p, grade: undefined }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              disabled={isSubmitting}
              placeholder="הכנס ציון"
              dir="ltr"
              className="text-start"
            />
            {errors.grade !== undefined && (
              <p className="text-xs text-red-600">{errors.grade}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="override-reason">סיבה לעקיפה</Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrors((p) => ({ ...p, reason: undefined }));
              }}
              disabled={isSubmitting}
              placeholder="פציעה, מחלה, נסיבות מיוחדות..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'שומר...' : 'שמור ציון'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
