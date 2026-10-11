import type { ReactNode } from 'react';
import { lazy, Suspense } from 'react';

import type { StudentOption } from '@/features/students/types/students.types';
import { PanelSkeleton } from '@/shared/ui/LoadingSkeletons';

const LazyCashDebtFilter = lazy(() =>
  import('./CashDebtFilter').then(({ CashDebtFilter }) => ({ default: CashDebtFilter })),
);

type CashDebtViewPanelProps = {
  showStudentFilter: boolean;
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
  children: ReactNode;
};

export function CashDebtViewPanel({ showStudentFilter, studentScope, actions, children }: CashDebtViewPanelProps) {
  return (
    <div>
      {showStudentFilter && (
        <Suspense fallback={<PanelSkeleton rows={2} label="Memuat filter tunggakan..." className="mb-4" />}>
          <LazyCashDebtFilter studentScope={studentScope} actions={actions} />
        </Suspense>
      )}
      {children}
    </div>
  );
}
