import { useId, useState, type ChangeEvent, type ReactNode } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';

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
import { cn } from '@/shared/utils/cn';
import { FieldError } from '@/shared/ui/FieldError';

type AsyncAction = () => Promise<void> | void;

interface DialogState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DialogContentCopy {
  title: string;
  description: ReactNode;
}

interface ActionDialogProps {
  dialog: DialogState;
  content: DialogContentCopy;
  action: {
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: AsyncAction;
  };
  destructive?: boolean;
}

interface ReasonDialogProps {
  dialog: DialogState;
  content: DialogContentCopy;
  action: {
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: (reason: string) => Promise<void> | void;
  };
  reason?: {
    label?: string;
    placeholder?: string;
  };
  destructive?: boolean;
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
  dialog,
  content,
  action,
  destructive = false,
}: ActionDialogProps) {
  const { open, onOpenChange } = dialog;
  const { title, description } = content;
  const { confirmLabel = 'Konfirmasi', cancelLabel = 'Batal', onConfirm } = action;
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
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs h-9"
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
  dialog,
  content,
  action,
  reason: reasonConfig,
  destructive = false,
}: ReasonDialogProps) {
  const { open, onOpenChange } = dialog;
  const { title, description } = content;
  const { confirmLabel = 'Simpan', cancelLabel = 'Batal', onConfirm } = action;
  const { label: reasonLabel = 'Alasan *', placeholder: reasonPlaceholder = 'Masukkan alasan (minimal 5 karakter)...' } = reasonConfig ?? {};
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const reasonInputId = useId();
  const reasonErrorId = `${reasonInputId}-error`;
  const { isSubmitting, setIsSubmitting, errorMessage, setErrorMessage } = useActionDialogState();

  const handleConfirm = async () => {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      setReasonError('Alasan wajib diisi minimal 5 karakter.');
      return;
    }

    setReasonError(null);
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
        setReasonError(null);
        setErrorMessage(null);
      }
      onOpenChange(nextOpen);
    }
  };

  const handleReasonChange = (event: ChangeEvent<HTMLInputElement>) => {
    setReason(event.target.value);
    if (reasonError) setReasonError(null);
    if (errorMessage) setErrorMessage(null);
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
          <Label htmlFor={reasonInputId} className="text-ink-muted text-xs font-semibold">
            {reasonLabel}
          </Label>
          <Input
            id={reasonInputId}
            autoFocus
            value={reason}
            onChange={handleReasonChange}
            placeholder={reasonPlaceholder}
            disabled={isSubmitting}
            aria-invalid={Boolean(reasonError)}
            aria-describedby={reasonError ? reasonErrorId : undefined}
            className={cn(
              'bg-surface-2 border-hairline text-ink text-xs h-9',
              reasonError && 'border-semantic-danger',
            )}
          />
          <FieldError id={reasonErrorId} message={reasonError} />
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs h-9"
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
  dialog: DialogState;
  content: DialogContentCopy;
  action?: {
    closeLabel?: string;
  };
}

export function NoticeDialog({
  dialog,
  content,
  action,
}: NoticeDialogProps) {
  const { open, onOpenChange } = dialog;
  const { title, description } = content;
  const { closeLabel = 'Tutup' } = action ?? {};
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
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="text-xs h-9"
          >
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
