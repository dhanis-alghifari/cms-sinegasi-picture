import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { formatPaymentMethodLabel } from '@/shared/utils/formatLabels';
import { UI_CONSTANTS } from '@/shared/constants/ui';

import type { StudentOption } from '@/features/students/types/students.types';
import { CashStudentScopeControl } from './CashStudentScopeControl';
import type { CashPaymentMethod } from '../types/cash.types';

type CashTransactionFilterProps = {
  filters: {
    startDate: string;
    endDate: string;
    paymentMethodCode: string;
    paymentMethods: CashPaymentMethod[];
    totalTransactions?: number;
  };
  studentScope: {
    canFilter: boolean;
    selectedStudent: StudentOption | null;
    options: StudentOption[];
    isLoading: boolean;
    error?: unknown;
  };
  actions: {
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onPaymentMethodChange: (value: string) => void;
    onStudentValueChange: (studentId: string) => void;
    onSelectedStudentChange: (student: StudentOption | null) => void;
    onStudentSearchChange: (value: string) => void;
    onReset: () => void;
    onRetryStudentOptions: () => void;
  };
};

function getTransactionCountLabel(
  totalTransactions: number | undefined,
  selectedStudent: StudentOption | null,
): string {
  if (totalTransactions === undefined) {
    return 'Memuat jumlah transaksi...';
  }

  if (selectedStudent) {
    return `${totalTransactions} pembayaran kas untuk ${selectedStudent.nama}`;
  }

  return `${totalTransactions} pembayaran kas dari seluruh siswa`;
}

export function CashTransactionFilter({
  filters,
  studentScope,
  actions,
}: CashTransactionFilterProps) {
  const { startDate, endDate, paymentMethodCode, paymentMethods, totalTransactions } = filters;
  const {
    canFilter: canFilterByStudent,
    selectedStudent,
    options: studentOptions,
    isLoading: isStudentOptionsLoading,
    error: studentOptionsError,
  } = studentScope;
  const {
    onStartDateChange,
    onEndDateChange,
    onPaymentMethodChange,
    onStudentValueChange,
    onSelectedStudentChange,
    onStudentSearchChange,
    onReset,
    onRetryStudentOptions,
  } = actions;
  const hasActiveFilters = Boolean(startDate || endDate || paymentMethodCode || selectedStudent);
  const transactionCountLabel = getTransactionCountLabel(totalTransactions, selectedStudent);
  const handlePaymentMethodValueChange = (value: string | null) => {
    onPaymentMethodChange(value === UI_CONSTANTS.ALL_FILTER_VALUE || !value ? '' : value);
  };

  return (
    <section className="mb-4 rounded-xl border border-hairline bg-surface-1 p-3">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {canFilterByStudent && (
          <CashStudentScopeControl
            selectedStudent={selectedStudent}
            studentOptions={studentOptions}
            isLoading={isStudentOptionsLoading}
            onValueChange={onStudentValueChange}
            onSelectedStudentChange={onSelectedStudentChange}
            onSearchChange={onStudentSearchChange}
          />
        )}
        <label className="block min-w-0 space-y-1 text-xs font-medium text-ink-subtle">
          <span>Tanggal mulai</span>
          <Input
            type="date"
            aria-label="Tanggal mulai transaksi"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="text-xs text-ink"
          />
        </label>
        <label className="block min-w-0 space-y-1 text-xs font-medium text-ink-subtle">
          <span>Tanggal selesai</span>
          <Input
            type="date"
            aria-label="Tanggal selesai transaksi"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="text-xs text-ink"
          />
        </label>
        <label className="block min-w-0 space-y-1 text-xs font-medium text-ink-subtle">
          <span>Metode pembayaran</span>
          <Select
            value={paymentMethodCode || UI_CONSTANTS.ALL_FILTER_VALUE}
            onValueChange={handlePaymentMethodValueChange}
          >
            <SelectTrigger className="text-xs text-ink" aria-label="Filter metode pembayaran">
              <SelectValue placeholder="Semua metode" />
            </SelectTrigger>
            <SelectContent className="border-hairline bg-surface-3 text-ink">
              <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua metode</SelectItem>
              {paymentMethods.map((method) => (
                <SelectItem key={method.id} value={method.code}>
                  {formatPaymentMethodLabel(method.code, method.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 text-xs text-ink-subtle" role="status" aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{transactionCountLabel}</span>
          {selectedStudent && <span>{selectedStudent.nis} / {selectedStudent.kelas}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden lg:inline">Filter siswa juga berlaku di tab Tunggakan.</span>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              className="min-h-10 text-xs text-ink-subtle lg:min-h-8"
            >
              Reset filter
            </Button>
          )}
        </div>
      </div>

      {Boolean(studentOptionsError) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-semantic-danger" role="alert">
          <span>{getErrorMessage(studentOptionsError)}</span>
          <Button type="button" variant="ghost" onClick={onRetryStudentOptions} className="min-h-9 px-2 text-xs text-semantic-danger">
            Coba lagi
          </Button>
        </div>
      )}
    </section>
  );
}
