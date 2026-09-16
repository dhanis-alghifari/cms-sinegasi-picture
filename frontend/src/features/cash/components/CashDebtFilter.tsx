import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';

import type { StudentOption } from '@/features/students/types/students.types';
import { CashStudentScopeControl } from './CashStudentScopeControl';

type CashDebtFilterProps = {
  studentScope: {
    selectedStudent: StudentOption | null;
    options: StudentOption[];
    isLoading: boolean;
    error?: unknown;
    totalDebts?: number;
  };
  actions: {
    onValueChange: (studentId: string) => void;
    onSelectedStudentChange: (student: StudentOption | null) => void;
    onSearchChange: (value: string) => void;
    onClear: () => void;
    onRetry: () => void;
  };
};

function getDebtCountLabel(totalDebts: number | undefined, selectedStudent: StudentOption | null): string {
  if (totalDebts === undefined) {
    return 'Memuat jumlah tunggakan...';
  }

  if (selectedStudent) {
    return `${totalDebts} tunggakan aktif untuk ${selectedStudent.nama}`;
  }

  return `${totalDebts} tunggakan aktif dari seluruh siswa`;
}

export function CashDebtFilter({
  studentScope,
  actions,
}: CashDebtFilterProps) {
  const {
    selectedStudent,
    options: studentOptions,
    isLoading: isStudentOptionsLoading,
    error: studentOptionsError,
    totalDebts,
  } = studentScope;
  const {
    onValueChange: onStudentValueChange,
    onSelectedStudentChange,
    onSearchChange: onStudentSearchChange,
    onClear: onClearStudentScope,
    onRetry: onRetryStudentOptions,
  } = actions;

  return (
    <section className="mb-4 rounded-xl border border-hairline bg-surface-1 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <CashStudentScopeControl
          selectedStudent={selectedStudent}
          studentOptions={studentOptions}
          isLoading={isStudentOptionsLoading}
          onValueChange={onStudentValueChange}
          onSelectedStudentChange={onSelectedStudentChange}
          onSearchChange={onStudentSearchChange}
        />
        {selectedStudent && (
          <Button
            type="button"
            variant="outline"
            onClick={onClearStudentScope}
            className="min-h-12 text-xs text-ink-subtle lg:min-h-9"
          >
            Hapus siswa
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 text-xs text-ink-subtle" role="status" aria-live="polite">
        <span>{getDebtCountLabel(totalDebts, selectedStudent)}</span>
        {selectedStudent && <span>{selectedStudent.nis} / {selectedStudent.kelas}</span>}
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
