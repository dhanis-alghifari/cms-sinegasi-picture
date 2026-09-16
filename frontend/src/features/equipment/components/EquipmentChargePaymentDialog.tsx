import { useMemo, useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { FormattedNumberInput } from '@/shared/ui/FormattedNumberInput';
import { cn } from '@/shared/utils/cn';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { getErrorMessage } from '@/shared/api/errors';
import type { EquipmentChargeSettlement, EquipmentRecoveryCase } from '../types/equipment.types';
import { ReturnEvidenceUploadField } from '@/features/borrowing/components/ReturnEvidenceUploadField';

type EquipmentChargePaymentSubmit = {
  paymentAmount: number;
  paymentEvidence: File[];
  resolutionEvidence: File[];
  notes?: string;
  changeReason: string;
};

interface EquipmentChargePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge?: EquipmentChargeSettlement | null;
  recoveryCase?: EquipmentRecoveryCase | null;
  isLoading?: boolean;
  error?: unknown;
  onSubmit: (payload: EquipmentChargePaymentSubmit) => Promise<void>;
}

export function EquipmentChargePaymentDialog({ open, onOpenChange, charge, recoveryCase, isLoading, error, onSubmit }: EquipmentChargePaymentDialogProps) {
  const [paymentAmount, setPaymentAmount] = useState<number | undefined>();
  const [paymentEvidence, setPaymentEvidence] = useState<File[]>([]);
  const [resolutionEvidence, setResolutionEvidence] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [changeReason, setChangeReason] = useState('Mencatat pembayaran tagihan alat');
  const [localError, setLocalError] = useState<string | null>(null);
  const [processingEvidenceCount, setProcessingEvidenceCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const remaining = useMemo(() => charge ? Math.max(0, charge.amount - charge.paid_amount) : 0, [charge]);
  const isFullPayment = Boolean(paymentAmount && paymentAmount >= remaining && remaining > 0);
  const resolutionMinimum = recoveryCase?.recovery_type === 'replacement' ? 3 : 2;
  const resolutionRequired = Boolean(isFullPayment && recoveryCase);

  const isProcessingEvidence = processingEvidenceCount > 0;
  const isBusy = Boolean(isLoading || isSubmitting);
  const setEvidenceProcessing = (processing: boolean) => {
    setProcessingEvidenceCount((count) => Math.max(0, count + (processing ? 1 : -1)));
  };
  const close = () => { if (isBusy || isProcessingEvidence) return; setLocalError(null); onOpenChange(false); };
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) close();
  };
  const handlePaymentAmountChange = (value: number | undefined) => {
    setPaymentAmount(value);
    setLocalError(null);
  };
  const handlePaymentEvidenceChange = (files: File[]) => {
    setPaymentEvidence(files);
    setLocalError(null);
  };
  const handleResolutionEvidenceChange = (files: File[]) => {
    setResolutionEvidence(files);
    setLocalError(null);
  };
  const submit = async () => {
    if (!charge || isBusy || isProcessingEvidence) return;
    if (!paymentAmount || paymentAmount <= 0) { setLocalError('Jumlah pembayaran harus lebih besar dari 0.'); return; }
    if (paymentAmount > remaining) { setLocalError('Jumlah pembayaran tidak boleh melebihi sisa tagihan.'); return; }
    if (paymentEvidence.length === 0) { setLocalError('Unggah minimal 1 foto bukti pembayaran.'); return; }
    if (resolutionRequired && resolutionEvidence.length < resolutionMinimum) { setLocalError(`Unggah minimal ${resolutionMinimum} foto bukti ${recoveryCase?.recovery_type === 'replacement' ? 'alat pengganti' : 'hasil perbaikan'}.`); return; }
    if (changeReason.trim().length < 5) { setLocalError('Alasan perubahan minimal 5 karakter.'); return; }
    setLocalError(null);
    setIsSubmitting(true);
    try { await onSubmit({ paymentAmount, paymentEvidence, resolutionEvidence, notes: notes.trim() || undefined, changeReason: changeReason.trim() }); }
    catch (submitError) { setLocalError(getErrorMessage(submitError)); }
    finally { setIsSubmitting(false); }
  };

  const activeError = localError || (error ? getErrorMessage(error) : null);
  const resolutionEvidenceContent = (() => {
    if (!recoveryCase) {
      return (
        <p className="mt-4 rounded-lg border border-dashed border-hairline bg-surface-2/45 px-3 py-2.5 text-[10px] leading-4 text-ink-subtle">
          Bukti penyelesaian fisik diisi dari tab Tindak lanjut setelah kasus perbaikan atau penggantian dibuat.
        </p>
      );
    }

    const isReplacement = recoveryCase.recovery_type === 'replacement';
    const evidenceLabel = isReplacement ? 'Foto alat pengganti' : 'Foto hasil perbaikan';
    const evidenceDescription = isReplacement
      ? 'Foto alat pengganti yang sudah dibeli dan diterima.'
      : 'Foto alat setelah perbaikan atau servis selesai.';
    const badgeClass = resolutionRequired
      ? 'bg-semantic-warning/15 text-semantic-warning'
      : 'bg-surface-2 text-ink-muted';
    const badgeLabel = resolutionRequired ? 'Wajib saat lunas' : 'Opsional';

    return (
      <div className="mt-4 rounded-lg border border-hairline bg-surface-2/35 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-ink">Bukti penyelesaian alat</h2>
            <p className="mt-1 text-[10px] leading-4 text-ink-subtle">{evidenceDescription}</p>
          </div>
          <span className={cn('rounded-md px-2 py-1 text-[10px] font-medium', badgeClass)}>{badgeLabel}</span>
        </div>
        <div className="mt-3">
          <ReturnEvidenceUploadField
            field={{
              id: 'equipment-resolution-evidence',
              label: evidenceLabel,
              values: resolutionEvidence,
              onChange: handleResolutionEvidenceChange,
            }}
            validation={{ minFiles: resolutionMinimum, maxFiles: 5, required: resolutionRequired }}
            state={{ disabled: isBusy, onProcessingChange: setEvidenceProcessing }}
          />
        </div>
      </div>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl gap-0 overflow-hidden border-hairline bg-surface-1 p-0 text-ink sm:max-h-[min(92dvh,760px)]">
        <DialogHeader className="shrink-0 border-b border-hairline px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3 pr-8"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-semantic-warning/12 text-semantic-warning"><CreditCard size={17} aria-hidden="true" /></span><div className="min-w-0"><DialogTitle className="text-base font-semibold text-ink">Catat pembayaran tagihan alat</DialogTitle><DialogDescription className="mt-1 text-xs leading-5 text-ink-subtle">Simpan pembayaran bertahap dan bukti pendukung tanpa mengubah sisa tagihan secara manual.</DialogDescription></div></div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {activeError && <div role="alert" className="mb-3 rounded-lg border border-semantic-danger/25 bg-semantic-danger/8 px-3 py-2.5 text-xs leading-5 text-semantic-danger">{activeError}</div>}
          {charge && <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-hairline bg-surface-2/45 p-3 text-xs"><div><p className="text-ink-muted">Total tagihan</p><p className="mt-1 font-mono font-semibold text-ink">{formatCurrency(charge.amount)}</p></div><div><p className="text-ink-muted">Sudah dibayar</p><p className="mt-1 font-mono text-ink-subtle">{formatCurrency(charge.paid_amount)}</p></div><div><p className="text-ink-muted">Sisa</p><p className="mt-1 font-mono font-semibold text-semantic-danger">{formatCurrency(remaining)}</p></div></div>}
          <div className="space-y-1.5"><Label htmlFor="equipment-payment-amount" className="text-xs text-ink-muted">Jumlah pembayaran <span className="text-semantic-danger">*</span></Label><FormattedNumberInput id="equipment-payment-amount" value={paymentAmount} onChange={handlePaymentAmountChange} placeholder={formatCurrency(remaining)} min="1" className="h-10 bg-surface-2 text-sm" /><p className="text-[10px] leading-4 text-ink-tertiary">Masukkan nominal yang diterima sekarang. Status menjadi lunas otomatis jika nominal mencapai sisa tagihan.</p></div>
          <div className="mt-4">
            <ReturnEvidenceUploadField
              field={{
                id: 'equipment-payment-evidence',
                label: 'Bukti pembayaran',
                values: paymentEvidence,
                onChange: handlePaymentEvidenceChange,
              }}
              validation={{ minFiles: 1, maxFiles: 5, required: true }}
              state={{ disabled: isBusy, onProcessingChange: setEvidenceProcessing }}
            />
          </div>
          {resolutionEvidenceContent}
          <div className="mt-4 space-y-1.5"><Label htmlFor="equipment-payment-notes" className="text-xs text-ink-muted">Catatan <span className="font-normal text-ink-tertiary">(opsional)</span></Label><Textarea id="equipment-payment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="resize-none bg-surface-2 text-xs" placeholder="Contoh: pembayaran tunai diterima di kantor." /></div>
          <div className="mt-4 space-y-1.5"><Label htmlFor="equipment-payment-reason" className="text-xs text-ink-muted">Alasan audit <span className="text-semantic-danger">*</span></Label><Input id="equipment-payment-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} className="h-10 bg-surface-2 text-xs" /></div>
        </div>
        <DialogFooter className="shrink-0 border-t border-hairline bg-surface-2/45 px-4 py-3 sm:px-5"><Button type="button" variant="outline" onClick={close} disabled={isBusy || isProcessingEvidence} className="bg-surface-1 text-xs">Batal</Button><Button type="button" onClick={() => void submit()} disabled={isBusy || isProcessingEvidence || !charge} className="bg-semantic-warning text-xs text-white hover:bg-semantic-warning/90">{isBusy ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Menyimpan...</> : 'Simpan pembayaran'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { EquipmentChargePaymentSubmit };
