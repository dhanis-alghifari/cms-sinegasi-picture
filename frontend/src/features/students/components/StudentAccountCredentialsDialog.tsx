import { useState } from 'react';
import { Check, Copy, KeyRound, UserRound } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Label } from '@/shared/ui/primitives/label';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import type { StudentAccountCredentials } from '../types/students.types';

interface StudentAccountCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
  credentials?: StudentAccountCredentials | null;
}

export function StudentAccountCredentialsDialog({
  open,
  onOpenChange,
  studentName,
  credentials,
}: StudentAccountCredentialsDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!credentials) return null;

  const copyCredentials = async () => {
    const text = `Username: ${credentials.username}\nPassword sementara: ${credentials.temporary_password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), UI_CONSTANTS.CREDENTIAL_COPY_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ink text-base">
            <KeyRound size={17} className="text-primary" />
            Akun siswa berhasil dibuat
          </DialogTitle>
          <DialogDescription className="text-ink-subtle text-xs">
            Simpan kredensial {studentName ? `untuk ${studentName}` : 'ini'} sekarang. Password sementara hanya ditampilkan pada proses ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border border-semantic-warning/30 bg-semantic-warning/10 p-3">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <UserRound size={14} className="text-primary" />
            <span>Role: <strong className="text-ink">Anggota</strong></span>
          </div>
          <div className="space-y-1">
            <Label className="text-ink-tertiary text-[10px]">Username</Label>
            <div className="rounded bg-surface-2 px-3 py-2 font-mono text-sm text-ink select-all">{credentials.username}</div>
          </div>
          <div className="space-y-1">
            <Label className="text-ink-tertiary text-[10px]">Password sementara</Label>
            <div className="rounded bg-surface-2 px-3 py-2 font-mono text-sm text-ink select-all">{credentials.temporary_password}</div>
          </div>
          <p className="text-[11px] text-ink-muted">
            Akun akan diwajibkan mengganti password saat login pertama. Jangan simpan password di audit log.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={copyCredentials} className="bg-surface-2 border-hairline text-ink text-xs">
            {copied ? <Check size={14} className="mr-1.5 text-semantic-success" /> : <Copy size={14} className="mr-1.5" />}
            {copied ? 'Tersalin' : 'Salin kredensial'}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs">
            Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
