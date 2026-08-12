import { useState } from 'react';
import { UserCheck, UserX, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/shared/api/errors';

import type { Student } from '../types/students.types';

interface StudentStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student | null;
  onSubmit: (reason: string) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function StudentStatusDialog({
  open,
  onOpenChange,
  student,
  onSubmit,
  isLoading = false,
  error,
}: StudentStatusDialogProps) {
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const isDeactivating = student?.is_active ?? false;

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setReason('');
      setFormError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      setFormError('Alasan wajib diisi minimal 5 karakter.');
      return;
    }

    setFormError(null);
    try {
      await onSubmit(trimmedReason);
      handleDialogOpenChange(false);
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isDeactivating ? (
              <UserX size={18} className="text-semantic-warning" />
            ) : (
              <UserCheck size={18} className="text-semantic-success" />
            )}
            <DialogTitle className="text-ink text-base font-semibold">
              {isDeactivating ? 'Nonaktifkan Siswa sebagai Alumni' : 'Aktifkan Kembali Siswa'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            {isDeactivating
              ? 'Siswa tidak akan dihapus untuk menjaga histori. Akun login yang terhubung juga dinonaktifkan.'
              : 'Siswa dan akun login yang terhubung akan kembali berstatus aktif.'}
            {student && <strong className="text-ink"> [{student.nama}]</strong>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {(formError || Boolean(error)) && (
            <div role="alert" className="px-3.5 py-2.5 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs font-medium">
              {formError || getErrorMessage(error)}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="student-status-reason" className="text-ink-muted text-xs font-semibold">
              Alasan Perubahan Status *
            </Label>
            <Textarea
              id="student-status-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (formError) setFormError(null);
              }}
              placeholder={isDeactivating ? 'Contoh: Lulus dan sudah menjadi alumni.' : 'Contoh: Kembali aktif mengikuti kegiatan sekolah.'}
              rows={3}
              disabled={isLoading}
              className={cn('bg-surface-2 border-hairline text-ink text-xs', formError && 'border-semantic-danger')}
            />
            <p className="text-ink-tertiary text-[10px]">Minimal 5 karakter.</p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={isLoading} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                'text-white text-xs h-9 font-medium',
                isDeactivating ? 'bg-semantic-warning hover:bg-semantic-warning/80' : 'bg-semantic-success hover:bg-semantic-success/80',
              )}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              {isDeactivating ? 'Nonaktifkan Siswa' : 'Aktifkan Siswa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
