// PRD Rule: Inbound cash entry is optimized for field speed without mandatory proof upload requirement

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowDownRight } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { getLocalDateInputValue } from '@/shared/utils/formatDate';
import { useStudentOptionsQuery } from '@/features/students/hooks/useStudentOptionsQuery';
import type { StudentOption } from '@/features/students/types/students.types';

import { cashInSchema, type CashInFormValues } from '../schemas/cashSchema';
import type { CashPaymentMethod } from '../types/cash.types';
import { FastCashInFields } from './FastCashInFields';

interface FastCashInModalProps {
  dialog: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  submission: {
    onSubmit: (values: CashInFormValues) => Promise<void>;
    isLoading?: boolean;
    error?: unknown;
  };
  options: {
    paymentMethods: CashPaymentMethod[];
    paymentMethodsError?: unknown;
    nominalIuranWajib?: number;
    isPaymentMethodsLoading?: boolean;
  };
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
  dialog,
  submission,
  options,
}: FastCashInModalProps) {
  const { open, onOpenChange } = dialog;
  const { onSubmit, isLoading, error } = submission;
  const {
    paymentMethodsError,
    nominalIuranWajib = 5000,
    paymentMethods,
    isPaymentMethodsLoading = false,
  } = options;
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
  }) as number | undefined;

  const selectedPaymentMethod = useWatch({
    control: form.control,
    name: 'metode_pembayaran',
  });

  const paymentMode = useWatch({
    control: form.control,
    name: 'payment_mode',
  });

  const debtDifference = cashInType === 'iuran_wajib' && inputAmount !== undefined
    ? Math.max(0, nominalIuranWajib - inputAmount)
    : 0;
  const proofImage = useWatch({ control: form.control, name: 'foto_bukti_url' });
  const requiresPaymentMethod = cashInType === 'pemasukan' || paymentMode === 'pay_now';
  const submitLabel = paymentMode === 'unpaid' && cashInType === 'iuran_wajib' ? 'Catat sebagai tunggakan' : 'Catat Kas Masuk';

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

  const handleStudentChange = (value: string) => {
    form.setValue('student_id', value, { shouldValidate: true, shouldDirty: true });
  };

  const handleProofChange = (value: string) => {
    form.setValue('foto_bukti_url', value, { shouldValidate: true, shouldDirty: true });
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

        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
          <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 pb-2 [scroll-padding-bottom:1rem]">
            <FastCashInFields
              form={form}
              state={{
                cashInType,
                paymentMode,
                selectedPaymentMethod,
                selectedStudentId,
                selectedStudentOption,
                debtDifference,
                requiresPaymentMethod,
                proofImage,
              }}
              options={{
                studentOptions,
                isStudentOptionsLoading: studentOptionsQuery.isFetching,
                studentOptionsError: studentOptionsQuery.error,
                nominalIuranWajib,
                paymentMethods,
                paymentMethodsError,
                isPaymentMethodsLoading,
              }}
              feedback={{ isLoading, error }}
              actions={{
                onCashInTypeChange: handleCashInTypeChange,
                onPaymentModeChange: handlePaymentModeChange,
                onStudentChange: handleStudentChange,
                onSelectedStudentOptionChange: setSelectedStudentOption,
                onStudentSearchChange: setStudentSearch,
                onProofChange: handleProofChange,
                onProcessingChange: setIsImageProcessing,
              }}
            />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleDialogOpenChange(false)}
              className="text-xs"
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
              ) : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
