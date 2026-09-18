
import { Controller, type UseFormReturn } from 'react-hook-form';
import { AlertCircle, Coins, ReceiptText } from 'lucide-react';

import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/api/errors';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';
import { ImageUploadField } from './ImageUploadField';
import { FormattedNumberInput } from '@/shared/ui/FormattedNumberInput';
import { StudentSearchCombobox } from './StudentSearchCombobox';
import type { StudentOption } from '@/features/students/types/students.types';

import type { CashInFormValues } from '../schemas/cashSchema';
import type { CashPaymentMethod } from '../types/cash.types';

interface FastCashInFieldsProps {
  form: UseFormReturn<CashInFormValues>;
  state: {
    cashInType: CashInFormValues['type'];
    paymentMode: CashInFormValues['payment_mode'];
    selectedPaymentMethod?: string;
    selectedStudentId?: string;
    selectedStudentOption: StudentOption | null;
    debtDifference: number;
    requiresPaymentMethod: boolean;
    proofImage?: string;
  };
  options: {
    studentOptions: StudentOption[];
    isStudentOptionsLoading: boolean;
    studentOptionsError?: unknown;
    paymentMethods: CashPaymentMethod[];
    paymentMethodsError?: unknown;
    isPaymentMethodsLoading: boolean;
    nominalIuranWajib: number;
  };
  feedback: {
    isLoading?: boolean;
    error?: unknown;
  };
  actions: {
    onCashInTypeChange: (value: CashInFormValues['type']) => void;
    onPaymentModeChange: (value: CashInFormValues['payment_mode']) => void;
    onStudentChange: (value: string) => void;
    onSelectedStudentOptionChange: (option: StudentOption | null) => void;
    onStudentSearchChange: (value: string) => void;
    onProofChange: (value: string) => void;
    onProcessingChange: (value: boolean) => void;
  };
}

export function FastCashInFields({
  form,
  state,
  options,
  feedback,
  actions,
}: FastCashInFieldsProps) {
  const {
    cashInType,
    paymentMode,
    selectedPaymentMethod,
    selectedStudentId,
    selectedStudentOption,
    debtDifference,
    requiresPaymentMethod,
    proofImage,
  } = state;
  const {
    studentOptions,
    isStudentOptionsLoading,
    studentOptionsError,
    paymentMethods,
    paymentMethodsError,
    isPaymentMethodsLoading,
    nominalIuranWajib,
  } = options;
  const { isLoading = false, error } = feedback;
  const {
    onCashInTypeChange,
    onPaymentModeChange,
    onStudentChange,
    onSelectedStudentOptionChange,
    onStudentSearchChange,
    onProofChange,
    onProcessingChange,
  } = actions;
  const handlePaymentMethodValueChange = (value: string | null) => {
    if (!value) return;
    form.setValue('metode_pembayaran', value, { shouldValidate: true, shouldDirty: true });
  };
  return (
    <>
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
                onClick={() => onCashInTypeChange('iuran_wajib')}
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
                onClick={() => onCashInTypeChange('pemasukan')}
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
                  onClick={() => onPaymentModeChange('pay_now')}
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
                  onClick={() => onPaymentModeChange('unpaid')}
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
              onValueChange={handlePaymentMethodValueChange}
              disabled={isPaymentMethodsLoading || paymentMethods.length === 0 || isLoading}
            >
              <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs">
                <SelectValue placeholder={isPaymentMethodsLoading ? 'Memuat metode...' : 'Pilih metode pembayaran'} />
              </SelectTrigger>
              <SelectContent>
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
                onValueChange={onStudentChange}
                onSelectedOptionChange={onSelectedStudentOptionChange}
                onSearchChange={onStudentSearchChange}
                isLoading={isStudentOptionsLoading}
                disabled={isLoading}
                errorMessage={studentOptionsError ? getErrorMessage(studentOptionsError) : undefined}
              />
              {Boolean(studentOptionsError) && (
                <p role="alert" className="text-semantic-danger text-[10px]">{getErrorMessage(studentOptionsError)}</p>
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
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.tanggal && 'border-semantic-danger')}
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
                  className={cn('bg-surface-2 border-hairline text-ink text-xs font-mono', form.formState.errors.jumlah && 'border-semantic-danger')}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    if (cashInType === 'iuran_wajib' && value === 0) {
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
              className="bg-surface-2 border-hairline text-ink text-xs"
              {...form.register('keterangan')}
            />
          </div>

          <ImageUploadField
            field={{ id: 'foto_bukti_url', label: 'Foto Bukti Pembayaran (Opsional)', value: proofImage, onChange: onProofChange }}
            validation={{ error: form.formState.errors.foto_bukti_url?.message }}
            state={{ disabled: isLoading, onProcessingChange }}
          />
    </>
  );
}
