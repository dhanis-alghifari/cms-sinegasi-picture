// src/features/grades/components/BulkGradingModal.tsx
// Bulk Grading Entry Modal according to PRD Specs:
// Teacher selects assignment and inputs A-E letter grades for multiple students efficiently

import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, GraduationCap, Loader2, Plus, Search, X } from 'lucide-react';

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
import { getErrorMessage } from '@/shared/api/errors';
import { cn } from '@/lib/utils';

import { bulkGradingSchema, type BulkGradingFormValues } from '../schemas/gradeSchema';
import { ASSIGNMENT_CATEGORY_LABELS, type Assignment, type GradeLetter, type BulkGradeItem } from '../types/grades.types';
import { formatEnumLabel } from '@/shared/utils/formatLabels';

interface StudentOption {
  id: string;
  nama: string;
  kelas: string;
  nis?: string;
  peminatan?: string;
}

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
  const assignmentOptions = Array.isArray(assignments) ? assignments : [];
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

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-hidden flex flex-col pt-1">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs shrink-0">
              {getErrorMessage(error)}
            </div>
          )}

          {/* Assignment Selector */}
          <div className="space-y-1 shrink-0">
            <Label className="text-ink-muted text-xs">Pilih Tugas / Kegiatan Penilaian *</Label>
            <Select
              value={selectedAssignmentId}
              onValueChange={handleAssignmentChange}
            >
              <SelectTrigger className="w-full bg-surface-2 border-hairline text-ink text-xs h-9">
                <SelectValue placeholder="Pilih tugas...">
                  {selectedAssignment ? formatAssignmentLabel(selectedAssignment) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-hairline text-ink">
                {assignmentOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {formatAssignmentLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.assignment_id && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.assignment_id.message}</p>
            )}
          </div>

          <div className="space-y-1 shrink-0">
            <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
              Alasan Penyimpanan / Koreksi *
            </Label>
            <Input
              id="change_reason"
              placeholder="Contoh: Penilaian tugas sinematografi minggu ini"
              className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.change_reason && 'border-semantic-danger')}
              {...form.register('change_reason')}
            />
            {form.formState.errors.change_reason && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
            )}
          </div>

          {/* Student Grading List */}
          <div className="space-y-2 shrink-0" ref={studentPickerRef}>
            <Label htmlFor="student-picker" className="text-ink-muted text-xs font-semibold">
              Tambah Siswa yang Dinilai
            </Label>
            <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-start">
              <div className="relative flex-1">
                <Button
                  id="student-picker"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={studentPickerOpen}
                  aria-controls="student-picker-list"
                  onClick={() => setStudentPickerOpen((open) => !open)}
                  className="w-full justify-between bg-surface-2 border-hairline text-ink text-xs h-9 font-normal"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Search size={14} className="text-ink-tertiary shrink-0" />
                    {studentToAdd ? `${studentToAdd.nama} • ${studentToAdd.kelas}` : 'Cari atau pilih nama siswa...'}
                  </span>
                  <span className="text-ink-tertiary">⌄</span>
                </Button>

                {studentPickerOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-hairline bg-surface-3 p-2 shadow-lg">
                    <Input
                      autoFocus
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                      placeholder="Cari nama, NIS, kelas, atau peminatan..."
                      className="bg-surface-2 border-hairline text-ink text-xs h-8 mb-2"
                      aria-label="Cari siswa"
                    />
                    <div id="student-picker-list" role="listbox" aria-label="Daftar siswa" className="max-h-44 overflow-y-auto space-y-1">
                      {availableStudents.length === 0 ? (
                        <p className="text-ink-tertiary text-xs text-center py-4">
                          {eligibleStudents.length === selectedStudents.length ? 'Semua siswa yang sesuai sudah ditambahkan.' : 'Siswa tidak ditemukan.'}
                        </p>
                      ) : (
                        availableStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            role="option"
                            aria-selected={student.id === studentToAddId}
                            onClick={() => setStudentToAddId(student.id)}
                            className={cn(
                              'w-full rounded px-2 py-1.5 text-left text-xs hover:bg-surface-2 transition-colors',
                              student.id === studentToAddId && 'bg-primary/15 text-primary',
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block text-ink font-medium truncate">{student.nama}</span>
                                <span className="block text-ink-tertiary text-[10px]">
                                  {student.nis ? `${student.nis} • ` : ''}{student.kelas}{student.peminatan ? ` • ${student.peminatan}` : ''}
                                </span>
                              </span>
                              {student.id === studentToAddId && <Check size={14} className="shrink-0 text-primary" />}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Button
                type="button"
                onClick={handleAddStudent}
                disabled={!studentToAdd}
                className="w-full shrink-0 bg-primary hover:bg-primary-hover text-primary-foreground text-xs md:w-auto"
              >
                <Plus size={14} className="mr-1" />
                Tambah Siswa
              </Button>
            </div>
            <p className="text-ink-tertiary text-[10px]">
              Pilih siswa satu per satu. Hanya siswa yang ditambahkan yang masuk ke payload penilaian.
            </p>
          </div>

          {/* Selected student grading list */}
          <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1 border-t border-b border-hairline py-2 my-1">
            {selectedStudents.length === 0 ? (
              <p className="text-center text-ink-tertiary text-xs py-6 italic">
                Belum ada siswa yang dipilih untuk dinilai.
              </p>
            ) : (
              selectedStudents.map((s) => {
                const item = gradeMap[s.id] ?? { nilai: 'B', keterangan: '' };

                return (
                  <div key={s.id} className="p-2 rounded bg-surface-2/60 border border-hairline/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-ink font-semibold text-xs truncate">{s.nama}</p>
                      <p className="text-ink-tertiary text-[10px]">{s.nis ? `${s.nis} • ` : ''}{s.kelas}</p>
                    </div>

                    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
                      {/* Grade A-E selector */}
                      <Select
                        value={item.nilai}
                        onValueChange={(val) => val && handleGradeChange(s.id, val as GradeLetter)}
                      >
                        <SelectTrigger className="w-full bg-surface-1 border-hairline text-ink text-xs h-8 font-bold md:w-24">
                          <SelectValue placeholder="Pilih nilai" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface-3 border-hairline text-ink">
                          <SelectItem value="A">Nilai A (Sangat Baik)</SelectItem>
                          <SelectItem value="B">Nilai B (Baik)</SelectItem>
                          <SelectItem value="C">Nilai C (Cukup)</SelectItem>
                          <SelectItem value="D">Nilai D (Kurang)</SelectItem>
                          <SelectItem value="E">Nilai E (Sangat Kurang)</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Optional note */}
                      <Input
                        placeholder="Catatan nilai opsional"
                        value={item.keterangan}
                        onChange={(e) => handleKeteranganChange(s.id, e.target.value)}
                        className="w-full bg-surface-1 border-hairline text-ink text-xs h-8 md:w-40"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveStudent(s.id)}
                        aria-label={`Hapus ${s.nama} dari daftar penilaian`}
                        className="self-end text-ink-tertiary hover:text-semantic-danger hover:bg-semantic-danger/10 md:self-auto"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="bg-surface-2 border-hairline text-ink text-xs h-9">
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
