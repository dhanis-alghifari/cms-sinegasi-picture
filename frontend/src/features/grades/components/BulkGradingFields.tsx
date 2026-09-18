
import { useMemo, type RefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Check, Plus, Search, X } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { SearchableCombobox } from '@/shared/ui/SearchableCombobox';
import { getErrorMessage } from '@/shared/api/errors';
import { cn } from '@/shared/utils/cn';

import type { BulkGradingFormValues } from '../schemas/gradeSchema';
import { GRADE_LETTER_VALUES } from '../types/grades.types';
import type { Assignment, GradeLetter } from '../types/grades.types';
import { isOneOf } from '@/shared/utils/isOneOf';

export interface BulkGradingStudentOption {
  id: string;
  nama: string;
  kelas: string;
  nis?: string;
  peminatan?: string;
}

type GradeMap = Record<string, { nilai: GradeLetter; keterangan: string }>;

interface BulkGradingFieldsProps {
  form: UseFormReturn<BulkGradingFormValues>;
  assignment: {
    options: Assignment[];
    selectedId: string;
    selected?: Assignment;
    formatLabel: (assignment: Assignment) => string;
  };
  studentPicker: {
    ref: RefObject<HTMLDivElement | null>;
    open: boolean;
    search: string;
    selectedToAdd?: BulkGradingStudentOption;
    selectedToAddId: string;
    available: BulkGradingStudentOption[];
    eligible: BulkGradingStudentOption[];
    selected: BulkGradingStudentOption[];
  };
  grades: {
    map: GradeMap;
  };
  actions: {
    onAssignmentChange: (value: string | null) => void;
    onToggleStudentPicker: () => void;
    onStudentSearchChange: (value: string) => void;
    onSelectStudentToAdd: (studentId: string) => void;
    onAddStudent: () => void;
    onGradeChange: (studentId: string, grade: GradeLetter) => void;
    onKeteranganChange: (studentId: string, note: string) => void;
    onRemoveStudent: (studentId: string) => void;
  };
  error?: unknown;
}

export function BulkGradingFields({
  form,
  assignment,
  studentPicker,
  grades,
  actions,
  error,
}: BulkGradingFieldsProps) {
  const {
    options: assignmentOptions,
    selectedId: selectedAssignmentId,
    formatLabel: formatAssignmentLabel,
  } = assignment;
  const {
    ref: studentPickerRef,
    open: studentPickerOpen,
    search: studentSearch,
    selectedToAdd: studentToAdd,
    selectedToAddId: studentToAddId,
    available: availableStudents,
    eligible: eligibleStudents,
    selected: selectedStudents,
  } = studentPicker;
  const { map: gradeMap } = grades;
  const {
    onAssignmentChange,
    onToggleStudentPicker,
    onStudentSearchChange,
    onSelectStudentToAdd,
    onAddStudent,
    onGradeChange,
    onKeteranganChange,
    onRemoveStudent,
  } = actions;
  const searchableAssignmentOptions = useMemo(
    () => assignmentOptions.map((option) => ({
      id: option.id,
      label: formatAssignmentLabel(option),
    })),
    [assignmentOptions, formatAssignmentLabel],
  );
  const selectedAssignmentOption = useMemo(
    () => searchableAssignmentOptions.find((option) => option.id === selectedAssignmentId) ?? null,
    [searchableAssignmentOptions, selectedAssignmentId],
  );

  const handleGradeValueChange = (studentId: string, value: string | null) => {
    if (value === null) return;
    if (!isOneOf(value, GRADE_LETTER_VALUES)) return;
    onGradeChange(studentId, value);
  };
  return (
    <>
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs shrink-0">
              {getErrorMessage(error)}
            </div>
          )}

          {/* Assignment Selector */}
          <div className="space-y-1 shrink-0">
            <Label className="text-ink-muted text-xs">Pilih Tugas / Kegiatan Penilaian *</Label>
            <SearchableCombobox
              options={searchableAssignmentOptions}
              value={selectedAssignmentId}
              selectedOption={selectedAssignmentOption}
              onValueChange={onAssignmentChange}
              ariaLabel="Cari dan pilih tugas penilaian"
              triggerLabel="Buka daftar tugas penilaian"
              placeholder="Cari atau pilih tugas..."
              emptyMessage="Tugas penilaian tidak ditemukan."
              loadingMessage="Memuat daftar tugas..."
            />
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
              className={cn('bg-surface-2 border-hairline text-ink text-xs', form.formState.errors.change_reason && 'border-semantic-danger')}
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
                  onClick={onToggleStudentPicker}
                  className="w-full justify-between bg-surface-2 border-hairline text-ink text-xs font-normal"
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
                      onChange={(event) => onStudentSearchChange(event.target.value)}
                      placeholder="Cari nama, NIS, kelas, atau peminatan..."
                      className="bg-surface-2 border-hairline text-ink text-xs mb-2"
                      aria-label="Cari siswa"
                    />
                    <div id="student-picker-list" role="listbox" aria-label="Daftar siswa" className="max-h-44 overflow-y-auto space-y-1">
                      {availableStudents.length === 0 && (
                        <p className="text-ink-tertiary text-xs text-center py-4">
                          {eligibleStudents.length === selectedStudents.length ? 'Semua siswa yang sesuai sudah ditambahkan.' : 'Siswa tidak ditemukan.'}
                        </p>
                      )}
                      {availableStudents.length > 0 && availableStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            role="option"
                            aria-selected={student.id === studentToAddId}
                            onClick={() => onSelectStudentToAdd(student.id)}
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
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button
                type="button"
                onClick={onAddStudent}
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
            {selectedStudents.length === 0 && (
              <p className="text-center text-ink-tertiary text-xs py-6 italic">
                Belum ada siswa yang dipilih untuk dinilai.
              </p>
            )}
            {selectedStudents.length > 0 && selectedStudents.map((s) => {
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
                        onValueChange={(val) => handleGradeValueChange(s.id, val)}
                      >
                        <SelectTrigger className="w-full bg-surface-1 border-hairline text-ink text-xs font-bold md:w-24">
                          <SelectValue placeholder="Pilih nilai" />
                        </SelectTrigger>
                        <SelectContent>
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
                        onChange={(e) => onKeteranganChange(s.id, e.target.value)}
                          className="w-full bg-surface-1 border-hairline text-ink text-xs md:w-40"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveStudent(s.id)}
                        aria-label={`Hapus ${s.nama} dari daftar penilaian`}
                        className="self-end text-ink-tertiary hover:text-semantic-danger hover:bg-semantic-danger/10 md:self-auto"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                );
            })}
          </div>

    </>
  );
}
