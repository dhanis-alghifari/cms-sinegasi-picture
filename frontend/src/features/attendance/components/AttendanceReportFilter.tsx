import { RotateCcw } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { Input } from '@/shared/ui/primitives/input';
import { StudentSearchCombobox } from '@/shared/ui/StudentSearchCombobox';

import type { StudentOption } from '@/features/students/types/students.types';
import type { AttendanceReportPreset } from '../types/attendance.types';
import { getAttendanceReportPresetLabel } from '../utils/attendanceReportDates';

interface AttendanceReportFilterProps {
  studentOptions: StudentOption[];
  selectedStudent: StudentOption | null;
  studentId: string;
  preset: AttendanceReportPreset;
  dateFrom: string;
  dateTo: string;
  isStudentOptionsLoading?: boolean;
  rangeError?: string;
  onStudentChange: (studentId: string) => void;
  onSelectedStudentChange: (student: StudentOption | null) => void;
  onStudentSearchChange: (value: string) => void;
  onPresetChange: (preset: Exclude<AttendanceReportPreset, 'custom'>) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onReset: () => void;
}

const PRESETS: Array<Exclude<AttendanceReportPreset, 'custom'>> = [
  'this_month',
  'semester',
  'last_30_days',
  'last_90_days',
  'all_time',
];

export function AttendanceReportFilter({
  studentOptions,
  selectedStudent,
  studentId,
  preset,
  dateFrom,
  dateTo,
  isStudentOptionsLoading = false,
  rangeError,
  onStudentChange,
  onSelectedStudentChange,
  onStudentSearchChange,
  onPresetChange,
  onDateFromChange,
  onDateToChange,
  onReset,
}: AttendanceReportFilterProps) {
  return (
    <Card className="border-hairline bg-surface-1">
      <CardHeader className="pb-3">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <CardTitle className="text-sm text-ink">Filter rekap siswa</CardTitle>
            <CardDescription className="mt-1 text-xs text-ink-subtle">
              Pilih satu siswa dan periode untuk melihat seluruh riwayat kehadirannya.
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onReset} className="min-h-11 self-start px-2 text-xs text-ink-subtle hover:text-ink md:min-h-9">
            <RotateCcw size={14} className="mr-1.5" aria-hidden="true" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block space-y-1.5 text-xs font-medium text-ink-subtle">
          <span>Siswa <span className="text-semantic-danger">*</span></span>
          <StudentSearchCombobox
            options={studentOptions}
            value={studentId}
            selectedOption={selectedStudent}
            onValueChange={onStudentChange}
            onSelectedOptionChange={onSelectedStudentChange}
            onSearchChange={onStudentSearchChange}
            isLoading={isStudentOptionsLoading}
          />
        </label>

        <div className="space-y-2">
          <span className="block text-xs font-medium text-ink-subtle">Periode</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {PRESETS.map((option) => (
              <Button
                key={option}
                type="button"
                variant={preset === option ? 'default' : 'outline'}
                onClick={() => onPresetChange(option)}
                className="min-h-11 border-hairline text-xs"
              >
                {getAttendanceReportPresetLabel(option)}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium text-ink-subtle">
            <span>Tanggal mulai</span>
            <Input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => onDateFromChange(event.target.value)}
              className="border-hairline bg-surface-2 text-xs text-ink"
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-ink-subtle">
            <span>Tanggal selesai</span>
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => onDateToChange(event.target.value)}
              className="border-hairline bg-surface-2 text-xs text-ink"
            />
          </label>
        </div>
        {preset === 'all_time' && (
          <p className="text-[11px] text-ink-tertiary">Semua catatan absensi siswa akan dihitung. Riwayat tetap dimuat secara bertahap.</p>
        )}
        {rangeError && <p className="text-xs text-semantic-danger" role="alert">{rangeError}</p>}
      </CardContent>
    </Card>
  );
}
