import { useState, type ReactNode } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/shared/api/errors';
import { cn } from '@/lib/utils';

type AsyncAction = () => Promise<void> | void;

interface BaseActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: AsyncAction;
}

interface ReasonDialogProps extends Omit<BaseActionDialogProps, 'onConfirm'> {
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => Promise<void> | void;
}

function useActionDialogState() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return { isSubmitting, setIsSubmitting, errorMessage, setErrorMessage };
}

function ActionError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger"
    >
      {message}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  destructive = false,
  onConfirm,
}: BaseActionDialogProps) {
  const { isSubmitting, setIsSubmitting, errorMessage, setErrorMessage } = useActionDialogState();

  const handleConfirm = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onConfirm();
      setErrorMessage(null);
      onOpenChange(false);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isSubmitting) {
      if (!nextOpen) setErrorMessage(null);
      onOpenChange(nextOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className={destructive ? 'text-semantic-danger' : 'text-primary'} />
            <DialogTitle className="text-ink text-base font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">{description}</DialogDescription>
        </DialogHeader>

        <ActionError message={errorMessage} />

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="bg-surface-2 border-hairline text-ink text-xs h-9"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className={cn(
              'text-xs h-9 font-medium',
              destructive
                ? 'bg-semantic-danger hover:bg-semantic-danger/80 text-white'
                : 'bg-primary hover:bg-primary-hover text-primary-foreground',
            )}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {isSubmitting ? 'Memproses...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Simpan',
  cancelLabel = 'Batal',
  destructive = false,
  reasonLabel = 'Alasan *',
  reasonPlaceholder = 'Masukkan alasan (minimal 5 karakter)...',
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const { isSubmitting, setIsSubmitting, errorMessage, setErrorMessage } = useActionDialogState();

  const handleConfirm = async () => {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      setErrorMessage('Alasan wajib diisi minimal 5 karakter.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onConfirm(trimmedReason);
      setReason('');
      setErrorMessage(null);
      onOpenChange(false);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isSubmitting) {
      if (!nextOpen) {
        setReason('');
        setErrorMessage(null);
      }
      onOpenChange(nextOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className={destructive ? 'text-semantic-danger' : 'text-primary'} />
            <DialogTitle className="text-ink text-base font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">{description}</DialogDescription>
        </DialogHeader>

        <ActionError message={errorMessage} />

        <div className="space-y-1">
          <Label htmlFor="action-reason" className="text-ink-muted text-xs font-semibold">
            {reasonLabel}
          </Label>
          <Input
            id="action-reason"
            autoFocus
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder={reasonPlaceholder}
            disabled={isSubmitting}
            className="bg-surface-2 border-hairline text-ink text-xs h-9"
          />
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="bg-surface-2 border-hairline text-ink text-xs h-9"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className={cn(
              'text-xs h-9 font-medium',
              destructive
                ? 'bg-semantic-danger hover:bg-semantic-danger/80 text-white'
                : 'bg-primary hover:bg-primary-hover text-primary-foreground',
            )}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {isSubmitting ? 'Memproses...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NoticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  closeLabel?: string;
}

export function NoticeDialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel = 'Tutup',
}: NoticeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Info size={18} className="text-semantic-warning" />
            <DialogTitle className="text-ink text-base font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9"
          >
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
