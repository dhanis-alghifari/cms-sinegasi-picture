import { useState } from 'react';
import { Check, KeyRound, MessageCircle, UserRound } from 'lucide-react';

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
import { formatRoleLabel } from '@/shared/utils/formatLabels';
import type { StudentAccountCredentials } from '../types/students.types';
import { buildStudentCredentialsMessage, buildWhatsAppChatUrl } from '../utils/accountOnboarding';

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
  const [copyError, setCopyError] = useState<string | null>(null);

  if (!credentials) return null;

  const temporaryPassword = credentials.temporary_password;
  const whatsappUrl = credentials.whatsapp_number ? buildWhatsAppChatUrl(credentials.whatsapp_number) : null;
  const message = temporaryPassword ? buildStudentCredentialsMessage({
    studentName,
    username: credentials.username,
    temporaryPassword,
  }) : null;

  const copyAndOpenWhatsApp = async () => {
    if (!message || !whatsappUrl) return;
    setCopyError(null);
    // Open synchronously in the click gesture so mobile browsers don't block WhatsApp.
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), UI_CONSTANTS.CREDENTIAL_COPY_FEEDBACK_MS);
    } catch {
      setCopied(false);
      setCopyError('Pesan belum tersalin. Salin teks pesan yang terlihat, lalu tempelkan di WhatsApp.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ink text-base">
            <KeyRound size={17} className="text-primary" />
            {credentials.operation_replayed ? 'Akun siswa sudah berhasil dibuat' : 'Akun siswa berhasil dibuat'}
          </DialogTitle>
          <DialogDescription className="text-ink-subtle text-xs">
            {credentials.operation_replayed
              ? 'Permintaan ini merupakan pengulangan setelah percobaan sebelumnya berhasil. Demi keamanan, password tidak dapat ditampilkan atau dikirim ulang.'
              : `Simpan kredensial ${studentName ? `untuk ${studentName}` : 'ini'} sekarang. Password sementara hanya ditampilkan pada proses ini.`}
          </DialogDescription>
        </DialogHeader>

        {credentials.operation_replayed ? (
          <div role="status" className="space-y-2 rounded-md border border-semantic-warning/30 bg-semantic-warning/10 p-3 text-xs text-ink-muted">
            <p>Akun <strong className="text-ink">{credentials.username}</strong> sudah ada. Hubungi Guru Pembina jika password perlu diatur ulang.</p>
          </div>
        ) : (
          <div className="space-y-3 rounded-md border border-semantic-warning/30 bg-semantic-warning/10 p-3">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <UserRound size={14} className="text-primary" />
              <span>Role: <strong className="text-ink">{formatRoleLabel(credentials.role)}</strong></span>
            </div>
            <div className="space-y-1">
              <Label className="text-ink-tertiary text-[10px]">Username</Label>
              <div className="rounded bg-surface-2 px-3 py-2 font-mono text-sm text-ink select-all">{credentials.username}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-ink-tertiary text-[10px]">Password sementara</Label>
              <div className="rounded bg-surface-2 px-3 py-2 font-mono text-sm text-ink select-all">{temporaryPassword}</div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="student-credentials-whatsapp-message" className="text-ink-tertiary text-[10px]">Pesan WhatsApp untuk ditinjau sebelum dikirim</Label>
              <textarea
                id="student-credentials-whatsapp-message"
                readOnly
                value={message ?? ''}
                rows={7}
                className="w-full resize-y rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink"
              />
              <p className="text-[11px] text-ink-muted">
                WhatsApp akan membuka chat tanpa mengirim otomatis. Pesan disalin agar Anda dapat meninjau dan menekan Kirim sendiri.
              </p>
            </div>
          </div>
        )}

        {copyError && <p role="alert" className="text-xs text-semantic-danger">{copyError}</p>}

        <DialogFooter className="gap-2 sm:gap-2">
          {!credentials.operation_replayed && temporaryPassword && whatsappUrl && (
            <Button type="button" variant="outline" onClick={() => void copyAndOpenWhatsApp()} className="bg-surface-2 border-hairline text-ink text-xs">
              {copied ? <Check size={14} className="mr-1.5 text-semantic-success" /> : <MessageCircle size={14} className="mr-1.5" />}
              {copied ? 'Pesan tersalin · buka chat lagi' : 'Salin pesan & buka WhatsApp'}
            </Button>
          )}
          {!credentials.operation_replayed && temporaryPassword && !whatsappUrl && (
            <p role="alert" className="text-xs text-semantic-danger">Nomor WhatsApp tidak tersedia atau tidak valid. Salin kredensial secara manual dan periksa nomor siswa.</p>
          )}
          <Button type="button" onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs">
            Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
