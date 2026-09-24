import { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { FieldError } from '@/shared/ui/FieldError';
import { getErrorMessage } from '@/shared/api/errors';
import type { Student, UnlinkedStudentAccount } from '../types/students.types';
import { LegacyStudentAccountPicker } from './LegacyStudentAccountPicker';

interface LinkLegacyAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  onSubmit: (userId: string, reason: string) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function LinkLegacyAccountDialog({
  open,
  onOpenChange,
  student,
  onSubmit,
  isLoading = false,
  error,
}: LinkLegacyAccountDialogProps) {
  const [selectedAccount, setSelectedAccount] = useState<UnlinkedStudentAccount | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isLoading) onOpenChange(false);
  };

  const handleAccountChange = (account: UnlinkedStudentAccount | null) => {
    setSelectedAccount(account);
    setAccountError(null);
  };

  const handleReasonChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReason(event.target.value);
    if (reasonError) setReasonError(null);
    if (formError) setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    setReasonError(trimmedReason.length < 5 ? 'Alasan penautan wajib diisi minimal 5 karakter.' : null);
    setFormError(null);
    setAccountError(selectedAccount ? null : 'Pilih akun lama yang akan ditautkan ke profil ini.');
    if (!selectedAccount || trimmedReason.length < 5) return;

    try {
      await onSubmit(selectedAccount.id, trimmedReason);
      onOpenChange(false);
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg border-hairline bg-surface-1 text-ink">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 size={17} className="text-primary" aria-hidden="true" />
            Tautkan akun lama
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-subtle">
            Hubungkan akun yang belum tertaut ke profil siswa {student?.nama}. Nama akun mengikuti profil ini; username, password, dan peran tidak berubah.
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 pt-2">
          {(formError || Boolean(error)) && (
            <div role="alert" className="rounded-md border border-semantic-danger/30 bg-semantic-danger/10 px-3.5 py-2.5 text-xs font-medium text-semantic-danger">
              {formError || getErrorMessage(error)}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-ink-muted">Akun siswa lama *</Label>
            <LegacyStudentAccountPicker
              selectedAccount={selectedAccount}
              onSelectedAccountChange={handleAccountChange}
              disabled={isLoading}
              errorMessage={accountError}
              errorId="link-existing-account-error"
            />
            <FieldError id="link-existing-account-error" message={accountError} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="link-existing-student-reason" className="text-xs text-ink-muted">Alasan penautan *</Label>
            <Textarea
              id="link-existing-student-reason"
              value={reason}
              onChange={handleReasonChange}
              placeholder="Contoh: Menautkan akun siswa lama ke profil aktif"
              rows={3}
              disabled={isLoading}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? 'link-existing-student-reason-error' : undefined}
              className="bg-surface-2 text-xs"
            />
            <FieldError id="link-existing-student-reason-error" message={reasonError} />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" disabled={isLoading} onClick={() => handleOpenChange(false)} className="min-h-10">Batal</Button>
            <Button type="submit" disabled={isLoading} className="min-h-10">
              {isLoading ? <Loader2 size={15} className="mr-2 animate-spin" aria-hidden="true" /> : <Link2 size={15} className="mr-2" aria-hidden="true" />}
              Tautkan akun
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
