import { StudentSearchCombobox } from '@/shared/ui/StudentSearchCombobox';
import { cn } from '@/shared/utils/cn';

import type { StudentOption } from '@/features/students/types/students.types';

type CashStudentScopeControlProps = {
  selectedStudent: StudentOption | null;
  studentOptions: StudentOption[];
  isLoading: boolean;
  onValueChange: (studentId: string) => void;
  onSelectedStudentChange: (student: StudentOption | null) => void;
  onSearchChange: (value: string) => void;
  className?: string;
};

export function CashStudentScopeControl({
  selectedStudent,
  studentOptions,
  isLoading,
  onValueChange,
  onSelectedStudentChange,
  onSearchChange,
  className,
}: CashStudentScopeControlProps) {
  return (
    <label className={cn('block min-w-0 space-y-1 text-xs font-medium text-ink-subtle', className)}>
      <span>Nama siswa</span>
      <StudentSearchCombobox
        options={studentOptions}
        value={selectedStudent?.id}
        selectedOption={selectedStudent}
        onValueChange={onValueChange}
        onSelectedOptionChange={onSelectedStudentChange}
        onSearchChange={onSearchChange}
        isLoading={isLoading}
      />
    </label>
  );
}
