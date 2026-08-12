// src/features/users/components/ResetPasswordDialog.tsx
// PRD Sub-feature: Reset Password oleh Guru/Admin
// Generates temporary password, enforces is_first_login = true, displays temporary password ONCE

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/shared/api/errors';

import { resetPasswordSchema, type ResetPasswordFormValues } from '../schemas/userSchema';
import type { ResetPasswordResponse, UserAccount } from '../types/users.types';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userAccount?: UserAccount | null;
  onResetSubmit: (userId: string, changeReason: string) => Promise<ResetPasswordResponse | void>;
  isLoading?: boolean;
  error?: unknown;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userAccount,
  onResetSubmit,
  isLoading,
  error,
}: ResetPasswordDialogProps) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { change_reason: '' },
  });

  const [formError, setFormError] = useState<string | null>(null);

  const handleClose = () => {
    setTempPassword(null);
    setCopied(false);
    setCopyError(null);
    setFormError(null);
    form.reset({ change_reason: '' });
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (isLoading) return;
      handleClose();
      return;
    }
    onOpenChange(true);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!userAccount) return;
    setFormError(null);
    setCopyError(null);
    try {
      const result = await onResetSubmit(userAccount.id, data.change_reason);
      if (!result?.temporary_password) {
        setFormError('Server tidak mengembalikan password sementara. Jangan tutup dialog; hubungi administrator.');
        return;
      }
      setTempPassword(result.temporary_password);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err));
    }
  });

  const handleCopy = async () => {
    if (!tempPassword) return;
    setCopyError(null);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard tidak tersedia.');
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Tidak dapat menyalin otomatis. Pilih password lalu salin secara manual.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={18} className="text-semantic-warning" />
            <DialogTitle className="text-ink text-base font-semibold">Reset Password User</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Reset kata sandi akun <strong className="text-ink">@{userAccount?.username}</strong> ({userAccount?.nama}).
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          /* Step 2: Show Temporary Password ONCE */
          <div className="space-y-4 py-2">
            <div className="p-3 rounded bg-semantic-warning/15 border border-semantic-warning/30 text-semantic-warning text-xs flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Simpan Kata Sandi Sementara Ini!</p>
                <p className="mt-0.5 text-[11px]">
                  Kata sandi ini hanya ditampilkan sekali. Pengguna wajib menggantinya saat login berikutnya.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded bg-surface-2 border border-hairline-strong font-mono text-sm">
              <code
                className="flex-1 select-all text-ink font-bold tracking-wider"
                aria-label="Password sementara"
              >
                {tempPassword}
              </code>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={handleCopy}
                className="bg-surface-3 border-hairline text-ink text-xs h-8"
              >
                {copied ? <Check size={14} className="text-semantic-success" /> : <Copy size={14} />}
                {copied ? 'Tersalin' : 'Salin'}
              </Button>
            </div>
            {copyError && <p role="alert" className="text-semantic-danger text-[11px]">{copyError}</p>}

            <DialogFooter>
              <Button onClick={handleClose} className="w-full bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-medium">
                Selesai
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Step 1: Input Change Reason */
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {(formError || Boolean(error)) && (
              <div role="alert" className="px-3.5 py-2.5 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs font-medium">
                {formError || getErrorMessage(error)}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
                Alasan Reset Password (Wajib untuk Audit Log) *
              </Label>
              <Input
                id="change_reason"
                placeholder="cth. Siswa lupa password / permintaan reset guru"
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('change_reason')}
              />
              {form.formState.errors.change_reason && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="bg-surface-2 border-hairline text-ink text-xs h-9">
                Batal
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-semantic-warning hover:bg-semantic-warning/80 text-black font-semibold text-xs h-9">
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                    Mereset...
                  </>
                ) : (
                  'Reset Password Now'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
