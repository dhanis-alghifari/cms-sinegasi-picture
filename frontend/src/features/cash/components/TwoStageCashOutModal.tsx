// src/features/cash/components/TwoStageCashOutModal.tsx
// Two-Stage Outbound Cash Modal according to PRD Specs:
// Tahap 1: Input Nominal & Validate against current balance (No negative balance)
// Tahap 2: Input Detailed Description for accountability

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

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
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';

import { cashOutSchema, type CashOutFormValues } from '../schemas/cashSchema';

interface TwoStageCashOutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  onSubmit: (values: CashOutFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function TwoStageCashOutModal({
  open,
  onOpenChange,
  currentBalance,
  onSubmit,
  isLoading,
  error,
}: TwoStageCashOutModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isImageProcessing, setIsImageProcessing] = useState(false);

  const form = useForm<CashOutFormValues>({
    resolver: zodResolver(cashOutSchema),
    defaultValues: {
      jumlah: 0,
      keterangan: '',
      foto_bukti_url: '',
    },
  });

  const inputAmount = useWatch({
    control: form.control,
    name: 'jumlah',
  }) || 0;

  const isInsufficient = inputAmount > currentBalance;
  const proofImage = useWatch({ control: form.control, name: 'foto_bukti_url' });

  const handleNextStep = async () => {
    const isValid = await form.trigger('jumlah');
    if (isValid && !isInsufficient && inputAmount > 0) {
      setStep(2);
    }
  };

  const handleBackStep = () => {
    setStep(1);
  };

  const handleClose = () => {
    setStep(1);
    form.reset();
    onOpenChange(false);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    handleClose();
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight size={18} className="text-semantic-danger" />
            <DialogTitle className="text-ink text-base font-semibold">
              Input Pengeluaran Kas — {step === 1 ? 'Tahap 1: Nominal' : 'Tahap 2: Rincian'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            {step === 1
              ? 'Langkah 1 dari 2: Masukkan nominal pengeluaran dan cek kecukupan saldo.'
              : 'Langkah 2 dari 2: Isi rincian barang/tujuan pengeluaran untuk pertanggungjawaban.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between text-xs py-1 px-3 rounded bg-surface-2 border border-hairline">
          <span className={step === 1 ? 'text-primary font-semibold' : 'text-ink-subtle'}>
            1. Nominal Pengeluaran
          </span>
          <span className="text-ink-tertiary">➔</span>
          <span className={step === 2 ? 'text-primary font-semibold' : 'text-ink-subtle'}>
            2. Rincian & Pertanggungjawaban
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs">
              {getErrorMessage(error)}
            </div>
          )}

          {/* ── TAHAP 1: Nominal & Saldo Check ──────────────────── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="p-3 rounded bg-surface-2 border border-hairline">
                <span className="text-ink-subtle text-xs">Saldo Kas Berjalan:</span>
                <p className="text-lg font-bold text-ink tracking-tight">{formatCurrency(currentBalance)}</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="jumlah" className="text-ink-muted text-xs">Nominal Pengeluaran (Rp) *</Label>
                <Controller
                  control={form.control}
                  name="jumlah"
                  render={({ field }) => (
                    <FormattedNumberInput
                      {...field}
                      id="jumlah"
                      placeholder="Masukkan nominal pengeluaran"
                      className={cn(
                        'bg-surface-2 border-hairline text-ink text-xs h-9 font-mono',
                        (form.formState.errors.jumlah || isInsufficient) && 'border-semantic-danger',
                      )}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? 0)}
                    />
                  )}
                />
                {form.formState.errors.jumlah && (
                  <p className="text-semantic-danger text-[10px]">{form.formState.errors.jumlah.message}</p>
                )}
              </div>

              {/* Zero Negative Balance Protection Message */}
              {isInsufficient && (
                <div role="alert" className="p-2.5 rounded bg-semantic-danger/15 border border-semantic-danger/30 text-semantic-danger text-xs font-medium">
                  ⛔ Saldo kas tidak mencukupi! Nominal ({formatCurrency(inputAmount)}) melebihi saldo kas saat ini ({formatCurrency(currentBalance)}). Transaksi ditolak oleh proteksi database.
                </div>
              )}
            </div>
          )}

          {/* ── TAHAP 2: Detail Pertanggungjawaban ──────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="p-2.5 rounded bg-semantic-success/15 border border-semantic-success/30 text-semantic-success text-xs flex items-center justify-between">
                <span>Nominal Dikonfirmasi: <strong>{formatCurrency(inputAmount)}</strong></span>
                <CheckCircle2 size={14} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="keterangan" className="text-ink-muted text-xs font-semibold">
                  Rincian Detail Pertanggungjawaban (Keterangan) *
                </Label>
                <Textarea
                  id="keterangan"
                  rows={3}
                  placeholder="Sebutkan detail barang yang dibeli, kuantitas, dan peruntukannya (cth: Beli SD Card SanDisk 64GB 2 unit untuk shooting film indie)..."
                  className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.keterangan && 'border-semantic-danger')}
                  {...form.register('keterangan')}
                />
                {form.formState.errors.keterangan && (
                  <p className="text-semantic-danger text-[10px]">{form.formState.errors.keterangan.message}</p>
                )}
              </div>

              <ImageUploadField
                id="foto_bukti_url"
                label="Foto Bukti Pengeluaran (Opsional)"
                value={proofImage}
                onChange={(value) => form.setValue('foto_bukti_url', value, { shouldValidate: true, shouldDirty: true })}
                error={form.formState.errors.foto_bukti_url?.message}
                disabled={isLoading}
                onProcessingChange={setIsImageProcessing}
              />

            </div>
          )}

          <DialogFooter className="pt-2">
            {step === 1 ? (
              <>
                <Button type="button" variant="outline" onClick={handleClose} className="bg-surface-2 border-hairline text-ink text-xs h-9">
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isInsufficient || inputAmount <= 0}
                  className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium"
                >
                  Lanjut ke Tahap 2
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleBackStep} className="bg-surface-2 border-hairline text-ink text-xs h-9">
                  <ArrowLeft size={14} className="mr-1" />
                  Kembali
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || isImageProcessing}
                  className="bg-semantic-danger hover:bg-semantic-danger/80 text-white text-xs h-9 font-medium"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-1.5" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Pengeluaran'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
