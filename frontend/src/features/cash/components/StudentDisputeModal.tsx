// src/features/cash/components/StudentDisputeModal.tsx
// Student Dispute Form Modal — PRD Requirement: MANDATORY Photo Proof URL Attachment

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, UploadCloud, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/shared/api/errors';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { ImageUploadField } from '@/shared/components/ImageUploadField';

import { disputeSchema, type DisputeFormValues } from '../schemas/cashSchema';
import type { CashTransaction } from '../types/cash.types';

interface StudentDisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: CashTransaction | null;
  onSubmit: (values: DisputeFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function StudentDisputeModal({
  open,
  onOpenChange,
  transaction,
  onSubmit,
  isLoading,
  error,
}: StudentDisputeModalProps) {
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const form = useForm<DisputeFormValues>({
    resolver: zodResolver(disputeSchema),
    defaultValues: {
      transaction_id: transaction?.id ?? '',
      reason: '',
      bukti_sanggahan_url: '',
    },
  });
  const proofImage = useWatch({ control: form.control, name: 'bukti_sanggahan_url' });

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!transaction) return;
    await onSubmit({
      ...data,
      transaction_id: transaction.id,
    });
    form.reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={18} className="text-semantic-warning" />
            <DialogTitle className="text-ink text-base font-semibold">Formulir Sanggahan Kas (Dispute)</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Sanggah transaksi kas masuk sebesar <strong className="text-ink">{formatCurrency(transaction?.jumlah ?? 0)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs">
              {getErrorMessage(error)}
            </div>
          )}

          {/* Alert Syarat Foto Bukti */}
          <div className="p-3 rounded bg-semantic-warning/15 border border-semantic-warning/30 text-semantic-warning text-xs">
            <p className="font-semibold flex items-center gap-1">
              <UploadCloud size={14} />
              Syarat Wajib Upload Bukti Sanggahan
            </p>
            <p className="mt-1 text-[11px]">
              Sesuai aturan PRD & proteksi database, sanggahan <strong>WAJIB</strong> menyertakan foto bukti pembayaran (screenshot transfer atau foto bukti fisik). Tanpa bukti, sanggahan tidak dapat diproses. Sanggahan dibatasi 1x per transaksi.
            </p>
          </div>

          {/* Alasan Sanggahan */}
          <div className="space-y-1">
            <Label htmlFor="reason" className="text-ink-muted text-xs">Alasan Sanggahan *</Label>
            <Textarea
              id="reason"
              rows={3}
              placeholder="Jelaskan kekeliruan pencatatan (cth. Saya sudah bayar Rp 10.000 via transfer pada tanggal 5 tapi dicatat Rp 5.000)..."
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.reason && 'border-semantic-danger')}
              {...form.register('reason')}
            />
            {form.formState.errors.reason && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.reason.message}</p>
            )}
          </div>

          <ImageUploadField
            id="bukti_sanggahan_url"
            label="Foto Bukti Pembayaran (Wajib)"
            value={proofImage}
            onChange={(value) => form.setValue('bukti_sanggahan_url', value, { shouldValidate: true, shouldDirty: true })}
            error={form.formState.errors.bukti_sanggahan_url?.message}
            required
            disabled={isLoading}
            onProcessingChange={setIsImageProcessing}
          />

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || isImageProcessing} className="bg-semantic-warning hover:bg-semantic-warning/80 text-black font-semibold text-xs h-9">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Mengirim...
                </>
              ) : (
                'Kirim Sanggahan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
