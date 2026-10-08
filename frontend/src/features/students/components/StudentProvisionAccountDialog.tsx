import { useRef, useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { getErrorMessage } from '@/shared/api/errors';
import { createOperationKey, normalizeWhatsAppNumber } from '../utils/accountOnboarding';
import type { Student } from '../types/students.types';

export interface StudentProvisionAccountInput {
  username: string;
  phoneNumber: string;
  changeReason: string;
  idempotencyKey: string;
}

interface StudentProvisionAccountDialogProps {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: StudentProvisionAccountInput) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function StudentProvisionAccountDialog({
  student,
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  error,
}: StudentProvisionAccountDialogProps) {
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(student.no_telepon ?? '');
  const [changeReason, setChangeReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const operation = useRef<{ fingerprint: string; key: string } | null>(null);

  const close = (nextOpen: boolean) => {
    if (!nextOpen && !isLoading) {
      setUsername('');
      setPhoneNumber(student.no_telepon ?? '');
      setChangeReason('');
      setConfirmed(false);
      setFormError(null);
      operation.current = null;
    }
    onOpenChange(nextOpen);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedPhone = normalizeWhatsAppNumber(phoneNumber);
    const reason = changeReason.trim();
    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername)) {
      setFormError('Username 3–30 karakter; gunakan huruf, angka, titik, _ atau -.');
      return;
    }
    if (!normalizedPhone) {
      setFormError('Masukkan nomor WhatsApp Indonesia yang valid.');
      return;
    }
    if (!confirmed) {
      setFormError('Konfirmasikan bahwa nomor tersebut aktif di WhatsApp dan milik siswa.');
      return;
    }
    if (reason.length < 5 || reason.length > 500) {
      setFormError('Alasan pembuatan akun wajib diisi 5–500 karakter.');
      return;
    }

    const fingerprint = JSON.stringify({ username: normalizedUsername, phoneNumber: normalizedPhone, reason });
    if (operation.current?.fingerprint !== fingerprint) {
      operation.current = { fingerprint, key: createOperationKey() };
    }
    try {
      await onSubmit({
        username: normalizedUsername,
        phoneNumber: normalizedPhone,
        changeReason: reason,
        idempotencyKey: operation.current.key,
      });
      operation.current = null;
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  };

  const visibleError = formError || (error ? getErrorMessage(error) : null);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ink text-base">
            <KeyRound size={17} className="text-primary" />
            Buat akun untuk {student.nama}
          </DialogTitle>
          <DialogDescription className="text-ink-subtle text-xs">
            Akun dibuat sebagai Anggota. Password sementara dibuat acak dan hanya ditampilkan sekali.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(event) => void submit(event)} className="space-y-3">
          {visibleError && <p role="alert" className="rounded-md border border-semantic-danger/30 bg-semantic-danger/10 p-2 text-xs text-semantic-danger">{visibleError}</p>}
          <div className="space-y-1">
            <Label htmlFor="provision-username">Username login *</Label>
            <Input
              id="provision-username"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="contoh: rara"
              disabled={isLoading}
              aria-invalid={Boolean(visibleError)}
            />
            <p className="text-[10px] text-ink-tertiary">Username ditentukan manual, bukan dibuat dari NIS.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="provision-whatsapp">Nomor WhatsApp *</Label>
            <Input
              id="provision-whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="081234567890"
              disabled={isLoading}
            />
            <p className="text-[10px] text-ink-tertiary">Tanpa OTP: pastikan nomor aktif dan benar secara manual sebelum membuat akun.</p>
            <label className="flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-2 text-xs text-ink-subtle">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={isLoading} />
              <span>Saya memastikan nomor ini aktif di WhatsApp dan milik siswa.</span>
            </label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="provision-reason">Alasan pembuatan akun *</Label>
            <Input
              id="provision-reason"
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              placeholder="Contoh: Melengkapi akun siswa lama"
              maxLength={500}
              disabled={isLoading}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={isLoading} onClick={() => close(false)}>Batal</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Membuat akun…' : 'Buat akun'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
