
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';

import { bulkGradingSchema, type BulkGradingFormValues } from '../schemas/gradeSchema';
import { ASSIGNMENT_CATEGORY_LABELS, type Assignment, type GradeLetter, type BulkGradeItem } from '../types/grades.types';
import { formatEnumLabel } from '@/shared/utils/formatLabels';
import { BulkGradingFields, type BulkGradingStudentOption } from './BulkGradingFields';

type StudentOption = BulkGradingStudentOption;

interface BulkGradingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: Assignment[];
  students: StudentOption[];
  onSubmit: (values: { assignment_id: string; grades: BulkGradeItem[]; change_reason: string }) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function BulkGradingModal({
  open,
  onOpenChange,
  assignments,
  students,
  onSubmit,
  isLoading,
  error,
}: BulkGradingModalProps) {
  const assignmentOptions = useMemo(() => (Array.isArray(assignments) ? assignments : []), [assignments]);
  const studentOptions = Array.isArray(students) ? students : [];
  const studentPickerRef = useRef<HTMLDivElement>(null);
  const [gradeMap, setGradeMap] = useState<Record<string, { nilai: GradeLetter; keterangan: string }>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentToAddId, setStudentToAddId] = useState('');

  const form = useForm<BulkGradingFormValues>({
    resolver: zodResolver(bulkGradingSchema),
    defaultValues: {
      assignment_id: '',
      change_reason: '',
    },
  });

  const selectedAssignmentId = useWatch({
    control: form.control,
    name: 'assignment_id',
  });

  const selectedAssignment = assignmentOptions.find((a) => a.id === selectedAssignmentId);
  const formatAssignmentLabel = (assignment: Assignment) =>
    `${assignment.title} (${ASSIGNMENT_CATEGORY_LABELS[assignment.category] ?? formatEnumLabel(assignment.category)} • Kelas ${assignment.kelas ?? 'Semua'})`;

  useEffect(() => {
    const currentAssignmentId = form.getValues('assignment_id');
    if (currentAssignmentId && !assignmentOptions.some((a) => a.id === currentAssignmentId)) {
      form.setValue('assignment_id', '', { shouldValidate: true });
    }
  }, [assignmentOptions, form]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (studentPickerRef.current && !studentPickerRef.current.contains(event.target as Node)) {
        setStudentPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Limit the picker by the assignment's target class, then let the teacher
  // choose only the students who actually submitted this assignment.
  const eligibleStudents = studentOptions.filter((s) => {
    if (!selectedAssignment?.kelas || selectedAssignment.kelas === 'Semua') return true;
    return s.kelas === selectedAssignment.kelas || s.kelas.startsWith(`${selectedAssignment.kelas} `);
  });

  const selectedStudents = selectedStudentIds
    .map((studentId) => eligibleStudents.find((student) => student.id === studentId))
    .filter((student): student is StudentOption => Boolean(student));

  const normalizedSearch = studentSearch.trim().toLowerCase();
  const availableStudents = eligibleStudents.filter((student) => {
    if (selectedStudentIds.includes(student.id)) return false;
    if (!normalizedSearch) return true;

    return [student.nama, student.nis, student.kelas, student.peminatan]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedSearch));
  });

  const studentToAdd = availableStudents.find((student) => student.id === studentToAddId);

  const handleGradeChange = (studentId: string, nilai: GradeLetter) => {
    setGradeMap((prev) => ({
      ...prev,
      [studentId]: {
        nilai,
        keterangan: prev[studentId]?.keterangan ?? '',
      },
    }));
  };

  const handleKeteranganChange = (studentId: string, keterangan: string) => {
    setGradeMap((prev) => ({
      ...prev,
      [studentId]: {
        nilai: prev[studentId]?.nilai ?? 'B',
        keterangan,
      },
    }));
  };

  const handleAssignmentChange = (value: string | null) => {
    if (!value || value === selectedAssignmentId) return;

    form.setValue('assignment_id', value, { shouldValidate: true });
    setSelectedStudentIds([]);
    setGradeMap({});
    setStudentToAddId('');
    setStudentSearch('');
  };

  const handleAddStudent = () => {
    if (!studentToAdd) return;

    setSelectedStudentIds((previous) => [...previous, studentToAdd.id]);
    setGradeMap((previous) => ({
      ...previous,
      [studentToAdd.id]: { nilai: 'B', keterangan: '' },
    }));
    setStudentToAddId('');
    setStudentSearch('');
    setStudentPickerOpen(false);
  };

  const handleToggleStudentPicker = () => {
    setStudentPickerOpen((open) => !open);
  };

  const handleRemoveStudent = (studentId: string) => {
    setSelectedStudentIds((previous) => previous.filter((id) => id !== studentId));
    setGradeMap((previous) => {
      const next = { ...previous };
      delete next[studentId];
      return next;
    });
  };

  const handleClose = () => {
    form.reset({ assignment_id: '', change_reason: '' });
    setGradeMap({});
    setSelectedStudentIds([]);
    setStudentPickerOpen(false);
    setStudentSearch('');
    setStudentToAddId('');
    onOpenChange(false);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    const grades: BulkGradeItem[] = selectedStudents.map((s) => {
      const item = gradeMap[s.id] ?? { nilai: 'B', keterangan: '' };
      return {
        student_id: s.id,
        nilai: item.nilai,
        keterangan: item.keterangan || undefined,
      };
    });

    await onSubmit({
      assignment_id: data.assignment_id,
      grades,
      change_reason: data.change_reason,
    });

    handleClose();
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-surface-1 border-hairline text-ink w-[calc(100%-2rem)] max-w-[calc(100vw-2rem)] max-h-[85dvh] overflow-hidden flex flex-col md:max-w-[min(40vw,1200px)]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={18} className="text-primary" />
            <DialogTitle className="text-ink text-base font-semibold">Input Penilaian Massal (Bulk Grading)</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Pilih siswa yang mengumpulkan tugas, lalu input predikat nilai (A, B, C, D, E).
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-hidden flex flex-col pt-1">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 pb-2">
            <BulkGradingFields
              form={form}
              assignment={{
                options: assignmentOptions,
                selectedId: selectedAssignmentId,
                selected: selectedAssignment,
                formatLabel: formatAssignmentLabel,
              }}
              studentPicker={{
                ref: studentPickerRef,
                open: studentPickerOpen,
                search: studentSearch,
                selectedToAdd: studentToAdd,
                selectedToAddId: studentToAddId,
                available: availableStudents,
                eligible: eligibleStudents,
                selected: selectedStudents,
              }}
              grades={{ map: gradeMap }}
              actions={{
                onAssignmentChange: handleAssignmentChange,
                onToggleStudentPicker: handleToggleStudentPicker,
                onStudentSearchChange: setStudentSearch,
                onSelectStudentToAdd: setStudentToAddId,
                onAddStudent: handleAddStudent,
                onGradeChange: handleGradeChange,
                onKeteranganChange: handleKeteranganChange,
                onRemoveStudent: handleRemoveStudent,
              }}
              error={error}
            />
          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} className="text-xs h-9">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || selectedStudents.length === 0} className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Penilaian Massal'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
