// src/features/cash/components/FastCashInModal.tsx
// Fast-Entry Cash Inbound Modal for Treasurer
// PRD Rule: Inbound cash entry is optimized for field speed without mandatory proof upload requirement

import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertCircle, ArrowDownRight, Coins, ReceiptText } from 'lucide-react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/shared/api/errors';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { getLocalDateInputValue } from '@/shared/utils/formatDate';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';
import { ImageUploadField } from '@/shared/components/ImageUploadField';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { useStudentOptionsQuery } from '@/features/students/queries/useStudentOptionsQuery';
import type { StudentOption } from '@/features/students/types/students.types';

import { cashInSchema, type CashInFormValues } from '../schemas/cashSchema';
import type { CashPaymentMethod } from '../types/cash.types';
import { StudentSearchCombobox } from './StudentSearchCombobox';

interface FastCashInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CashInFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
  paymentMethodsError?: unknown;
  nominalIuranWajib?: number;
  paymentMethods: CashPaymentMethod[];
  isPaymentMethodsLoading?: boolean;
}

function getDefaultCashInValues(nominalIuranWajib: number, paymentMethodCode = 'cash'): CashInFormValues {
  return {
    student_id: '',
    type: 'iuran_wajib',
    payment_mode: 'pay_now',
    tanggal: getLocalDateInputValue(),
    jumlah: nominalIuranWajib,
    keterangan: 'Iuran Kas Mingguan',
    foto_bukti_url: '',
    metode_pembayaran: paymentMethodCode,
  };
}

export function FastCashInModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  error,
  paymentMethodsError,
  nominalIuranWajib = 5000,
  paymentMethods,
  isPaymentMethodsLoading = false,
}: FastCashInModalProps) {
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentOption, setSelectedStudentOption] = useState<StudentOption | null>(null);
  const form = useForm<CashInFormValues>({
    resolver: zodResolver(cashInSchema),
    defaultValues: getDefaultCashInValues(nominalIuranWajib, paymentMethods[0]?.code),
  });

  useEffect(() => {
    if (open && !form.formState.isDirty) {
      form.setValue('jumlah', nominalIuranWajib);
      form.setValue('tanggal', getLocalDateInputValue());
      form.setValue('payment_mode', 'pay_now');
      form.setValue('metode_pembayaran', paymentMethods[0]?.code || 'cash');
    }
  }, [form, nominalIuranWajib, open, paymentMethods]);

  const cashInType = useWatch({
    control: form.control,
    name: 'type',
  });

  const selectedStudentId = useWatch({
    control: form.control,
    name: 'student_id',
  });
  const studentOptionsQuery = useStudentOptionsQuery(studentSearch, open && cashInType === 'iuran_wajib');
  const studentOptions = studentOptionsQuery.data?.data ?? [];

  const inputAmount = useWatch({
    control: form.control,
    name: 'jumlah',
  }) || 0;

  const selectedPaymentMethod = useWatch({
    control: form.control,
    name: 'metode_pembayaran',
  });

  const paymentMode = useWatch({
    control: form.control,
    name: 'payment_mode',
  });

  const debtDifference = cashInType === 'iuran_wajib' ? Math.max(0, nominalIuranWajib - inputAmount) : 0;
  const proofImage = useWatch({ control: form.control, name: 'foto_bukti_url' });
  const requiresPaymentMethod = cashInType === 'pemasukan' || paymentMode === 'pay_now';

  const handleCashInTypeChange = (value: CashInFormValues['type']) => {
    form.setValue('type', value, { shouldValidate: true, shouldDirty: true });
    form.setValue('payment_mode', 'pay_now', { shouldValidate: true, shouldDirty: true });
    form.setValue('jumlah', nominalIuranWajib, { shouldValidate: true, shouldDirty: true });
    form.setValue('metode_pembayaran', paymentMethods[0]?.code, { shouldValidate: true, shouldDirty: true });
    const currentDescription = form.getValues('keterangan')?.trim();
    if (!currentDescription || currentDescription === 'Iuran Kas Mingguan' || currentDescription === 'Pemasukan Lain-lain') {
      form.setValue('keterangan', value === 'pemasukan' ? 'Pemasukan Lain-lain' : 'Iuran Kas Mingguan', {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    if (value === 'pemasukan') {
      form.setValue('student_id', undefined, { shouldValidate: true, shouldDirty: true });
      setSelectedStudentOption(null);
    }
  };

  const handlePaymentModeChange = (value: CashInFormValues['payment_mode']) => {
    form.setValue('payment_mode', value, { shouldValidate: true, shouldDirty: true });
    if (value === 'unpaid') {
      form.setValue('jumlah', 0, { shouldValidate: true, shouldDirty: true });
      form.setValue('metode_pembayaran', undefined, { shouldValidate: true, shouldDirty: true });
      return;
    }
    form.setValue('jumlah', nominalIuranWajib, { shouldValidate: true, shouldDirty: true });
    form.setValue('metode_pembayaran', paymentMethods[0]?.code, { shouldValidate: true, shouldDirty: true });
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    form.reset(getDefaultCashInValues(nominalIuranWajib, paymentMethods[0]?.code));
    handleDialogOpenChange(false);
  });

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset(getDefaultCashInValues(nominalIuranWajib, paymentMethods[0]?.code));
      setIsImageProcessing(false);
      setStudentSearch('');
      setSelectedStudentOption(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="inset-0 top-0 left-0 h-[100dvh] w-full max-h-none max-w-none translate-x-0 translate-y-0 gap-3 overflow-hidden rounded-none border-hairline bg-surface-1 p-4 text-ink md:inset-auto md:top-1/2 md:left-1/2 md:h-[min(85dvh,48rem)] md:max-h-[min(85dvh,48rem)] md:w-[calc(100%-2rem)] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl">
        <DialogHeader className="shrink-0 pr-10">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownRight size={18} className="text-semantic-success" />
            <DialogTitle className="text-ink text-base font-semibold">Fast-Entry Input Kas Masuk</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Catat pemasukan kas dengan cepat. Foto bukti bersifat opsional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
          <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 pb-2 [scroll-padding-bottom:1rem]">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs">
              {getErrorMessage(error)}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-ink-muted text-xs">Jenis Pemasukan *</Label>
            <div
              role="radiogroup"
              aria-label="Jenis pemasukan"
              className="grid grid-cols-1 gap-2 md:grid-cols-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={cashInType === 'iuran_wajib'}
                onClick={() => handleCashInTypeChange('iuran_wajib')}
                className={cn(
                  'flex min-h-16 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                  cashInType === 'iuran_wajib'
                    ? 'border-semantic-success bg-semantic-success/10 text-ink ring-1 ring-semantic-success/30'
                    : 'border-hairline bg-surface-2 text-ink-subtle hover:border-semantic-success/50 hover:text-ink',
                )}
              >
                <ReceiptText size={18} className="shrink-0 text-semantic-success" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">Iuran Siswa</span>
                  <span className="block text-[10px] text-ink-subtle">Terhubung ke siswa dan hutang</span>
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={cashInType === 'pemasukan'}
                onClick={() => handleCashInTypeChange('pemasukan')}
                className={cn(
                  'flex min-h-16 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                  cashInType === 'pemasukan'
                    ? 'border-primary bg-primary/10 text-ink ring-1 ring-primary/30'
                    : 'border-hairline bg-surface-2 text-ink-subtle hover:border-primary/50 hover:text-ink',
                )}
              >
                <Coins size={18} className="shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">Pemasukan Lain-lain</span>
                  <span className="block text-[10px] text-ink-subtle">Tidak terhubung ke siswa</span>
                </span>
              </button>
            </div>
          </div>

          {cashInType === 'iuran_wajib' && (
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Status Pembayaran *</Label>
              <div role="radiogroup" aria-label="Status pembayaran" className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMode === 'pay_now'}
                  onClick={() => handlePaymentModeChange('pay_now')}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                    paymentMode === 'pay_now'
                      ? 'border-semantic-success bg-semantic-success/10 text-ink ring-1 ring-semantic-success/30'
                      : 'border-hairline bg-surface-2 text-ink-subtle hover:border-semantic-success/50 hover:text-ink',
                  )}
                >
                  <Coins size={17} className="shrink-0 text-semantic-success" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">Bayar sekarang</span>
                    <span className="block text-[10px] text-ink-subtle">Catat uang yang diterima</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMode === 'unpaid'}
                  onClick={() => handlePaymentModeChange('unpaid')}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                    paymentMode === 'unpaid'
                      ? 'border-semantic-warning bg-semantic-warning/10 text-ink ring-1 ring-semantic-warning/30'
                      : 'border-hairline bg-surface-2 text-ink-subtle hover:border-semantic-warning/50 hover:text-ink',
                  )}
                >
                  <AlertCircle size={17} className="shrink-0 text-semantic-warning" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">Belum bayar</span>
                    <span className="block text-[10px] text-ink-subtle">Buat tunggakan tanpa transaksi kas</span>
                  </span>
                </button>
              </div>
              {form.formState.errors.payment_mode && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.payment_mode.message}</p>
              )}
            </div>
          )}

          {requiresPaymentMethod && <div className="space-y-1">
            <Label className="text-ink-muted text-xs">Metode Pembayaran *</Label>
            <Select
              value={selectedPaymentMethod}
              onValueChange={(value) => value && form.setValue('metode_pembayaran', value, { shouldValidate: true, shouldDirty: true })}
              disabled={isPaymentMethodsLoading || paymentMethods.length === 0 || isLoading}
            >
              <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs min-h-12 h-auto md:h-9 md:min-h-0">
                <SelectValue placeholder={isPaymentMethodsLoading ? 'Memuat metode...' : 'Pilih metode pembayaran'} />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-hairline text-ink">
                {paymentMethods.map((method) => (
                  <SelectItem key={method.id} value={method.code}>{formatPaymentMethodLabel(method.code, method.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentMethods.length === 0 && !isPaymentMethodsLoading && (
              <p role="alert" className="text-semantic-danger text-[10px]">
                {paymentMethodsError ? getErrorMessage(paymentMethodsError) : 'Metode pembayaran belum tersedia. Hubungi administrator.'}
              </p>
            )}
            {form.formState.errors.metode_pembayaran && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.metode_pembayaran.message}</p>
            )}
          </div>}

          {cashInType === 'iuran_wajib' && paymentMode === 'unpaid' && (
            <div className="flex items-start gap-2 rounded-md border border-semantic-warning/30 bg-semantic-warning/10 p-2 text-semantic-warning text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>Tidak ada transaksi kas yang dibuat. Tunggakan sebesar <strong>{formatCurrency(nominalIuranWajib)}</strong> akan dicatat untuk periode minggu ini.</span>
            </div>
          )}

          {cashInType === 'iuran_wajib' && (
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Pilih Siswa *</Label>
              <StudentSearchCombobox
                options={studentOptions}
                value={selectedStudentId}
                selectedOption={selectedStudentOption}
                onValueChange={(value) => form.setValue('student_id', value, { shouldValidate: true, shouldDirty: true })}
                onSelectedOptionChange={setSelectedStudentOption}
                onSearchChange={setStudentSearch}
                isLoading={studentOptionsQuery.isFetching}
                disabled={isLoading}
                errorMessage={studentOptionsQuery.error ? getErrorMessage(studentOptionsQuery.error) : undefined}
              />
              {studentOptionsQuery.error && (
                <p role="alert" className="text-semantic-danger text-[10px]">{getErrorMessage(studentOptionsQuery.error)}</p>
              )}
              {form.formState.errors.student_id && (
                <p className="text-semantic-danger text-[10px]">{form.formState.errors.student_id.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="tanggal" className="text-ink-muted text-xs">Tanggal Transaksi *</Label>
            <Input
              id="tanggal"
              type="date"
              className={cn('bg-surface-2 border-hairline text-ink text-xs min-h-12 h-auto md:h-9 md:min-h-0', form.formState.errors.tanggal && 'border-semantic-danger')}
              {...form.register('tanggal')}
            />
            {form.formState.errors.tanggal && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.tanggal.message}</p>
            )}
          </div>

          {/* Jumlah Nominal */}
          <div className="space-y-1">
            <Label htmlFor="jumlah" className="text-ink-muted text-xs">Nominal Pemasukan (Rp) *</Label>
            <Controller
              control={form.control}
              name="jumlah"
              render={({ field }) => (
                <FormattedNumberInput
                  {...field}
                  id="jumlah"
                  placeholder="5,000"
                  disabled={cashInType === 'iuran_wajib' && paymentMode === 'unpaid'}
                  className={cn('bg-surface-2 border-hairline text-ink text-xs min-h-12 h-auto md:h-9 md:min-h-0 font-mono', form.formState.errors.jumlah && 'border-semantic-danger')}
                  value={field.value}
                  onChange={(value) => {
                    const amount = value ?? 0;
                    field.onChange(value ?? 0);
                    if (cashInType === 'iuran_wajib' && amount === 0) {
                      form.setValue('payment_mode', 'unpaid', { shouldValidate: true, shouldDirty: true });
                      form.setValue('metode_pembayaran', undefined, { shouldValidate: true, shouldDirty: true });
                    }
                  }}
                />
              )}
            />
            {form.formState.errors.jumlah && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.jumlah.message}</p>
            )}
          </div>

          {/* Auto Debt Indicator */}
          {cashInType === 'iuran_wajib' && paymentMode === 'pay_now' && debtDifference > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-semantic-warning/30 bg-semantic-warning/15 p-2 text-semantic-warning text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>Pembayaran kurang dari iuran wajib ({formatCurrency(nominalIuranWajib)}). Selisih <strong>{formatCurrency(debtDifference)}</strong> akan dicatat sebagai tunggakan siswa.</span>
            </div>
          )}

          {/* Keterangan */}
          <div className="space-y-1">
            <Label htmlFor="keterangan" className="text-ink-muted text-xs">Catatan / Keterangan (Opsional)</Label>
            <Input
              id="keterangan"
              placeholder="cth. Iuran Kas Mingguan"
              className="bg-surface-2 border-hairline text-ink text-xs min-h-12 h-auto md:h-9 md:min-h-0"
              {...form.register('keterangan')}
            />
          </div>

          <ImageUploadField
            id="foto_bukti_url"
            label="Foto Bukti Pembayaran (Opsional)"
            value={proofImage}
            onChange={(value) => form.setValue('foto_bukti_url', value, { shouldValidate: true, shouldDirty: true })}
            error={form.formState.errors.foto_bukti_url?.message}
            disabled={isLoading}
            onProcessingChange={setIsImageProcessing}
          />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              className="bg-surface-2 border-hairline text-ink text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isImageProcessing || isPaymentMethodsLoading || (requiresPaymentMethod && paymentMethods.length === 0)}
              className="bg-semantic-success hover:bg-semantic-success/80 text-white text-xs font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Mencatat...
                </>
              ) : (
                paymentMode === 'unpaid' && cashInType === 'iuran_wajib' ? 'Catat sebagai tunggakan' : 'Catat Kas Masuk'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
