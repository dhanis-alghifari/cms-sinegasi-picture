// src/features/attendance/components/RecordAttendanceModal.tsx
// Batch attendance entry with server-backed 10-row progressive roster loading.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck, ChevronDown, Loader2 } from 'lucide-react';

import { NoticeDialog } from '@/shared/ui/ActionDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/primitives/dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { cn } from '@/shared/utils/cn';
import { isOneOf } from '@/shared/utils/isOneOf';
import { getErrorMessage } from '@/shared/api/errors';
import type { ClassSelectorOption } from '@/features/classes/types/classes.types';

import { batchAttendanceSchema, type BatchAttendanceFormValues } from '../schemas/attendanceSchema';
import { useAttendanceRosterQuery } from '../hooks/useAttendanceQuery';
import { ATTENDANCE_STATUS_VALUES } from '../types/attendance.types';
import type { AttendanceStatus, RecordAttendanceItem } from '../types/attendance.types';

interface RecordAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ClassSelectorOption[];
  onSubmit: (values: { tanggal: string; kelas: string; records: RecordAttendanceItem[] }) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

const LEVEL_CHOICES = [
  { value: 'X', label: 'Kelas X (semua jurusan)' },
  { value: 'XI', label: 'Kelas XI (semua jurusan)' },
  { value: 'XII', label: 'Kelas XII (semua jurusan)' },
];

export function RecordAttendanceModal({
  open,
  onOpenChange,
  classes,
  onSubmit,
  isLoading,
  error,
}: RecordAttendanceModalProps) {
  const [selectedKelas, setSelectedKelas] = useState('X');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; keterangan: string }>>({});
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const previousTanggal = useRef<string | undefined>(undefined);

  const form = useForm<BatchAttendanceFormValues>({
    resolver: zodResolver(batchAttendanceSchema),
    defaultValues: {
      tanggal: new Date().toISOString().split('T')[0],
      kelas: 'X',
    },
  });
  const selectedTanggal = useWatch({ control: form.control, name: 'tanggal' });
  const rosterQuery = useAttendanceRosterQuery({
    tanggal: selectedTanggal,
    kelas: selectedKelas,
    pageSize: 10,
  }, open);
  const students = rosterQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const totalStudents = rosterQuery.data?.pages[0]?.total ?? 0;
  const loadedStudents = students.length;

  const classChoices = useMemo(() => {
    const exactClasses = classes
      // `/api/options/kelas` is already restricted to active classes and its
      // public option projection intentionally omits `is_active`.
      .filter((item) => !LEVEL_CHOICES.some((level) => level.value === item.nama_kelas))
      .map((item) => ({ value: item.nama_kelas, label: item.nama_kelas }));
    const seen = new Set<string>();
    return [...LEVEL_CHOICES, ...exactClasses].filter((item) => {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    });
  }, [classes]);

  useEffect(() => {
    if (previousTanggal.current !== undefined && previousTanggal.current !== selectedTanggal) {
      setAttendanceMap({});
    }
    previousTanggal.current = selectedTanggal;
  }, [selectedTanggal]);

  const itemFor = (student: (typeof students)[number]) => attendanceMap[student.student_id] ?? {
    status: student.status ?? 'hadir',
    keterangan: student.keterangan ?? '',
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        status,
        keterangan: prev[studentId]?.keterangan ?? '',
      },
    }));
  };

  const handleKeteranganChange = (studentId: string, keterangan: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status ?? 'hadir',
        keterangan,
      },
    }));
  };

  const handleClose = () => {
    setAttendanceMap({});
    setValidationMessage(null);
    onOpenChange(false);
  };

  const handleClassChange = (value: string) => {
    setSelectedKelas(value);
    form.setValue('kelas', value, { shouldValidate: true });
    setAttendanceMap({});
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    if (rosterQuery.hasNextPage) {
      setValidationMessage('Gulir sampai daftar siswa selesai dimuat sebelum menyimpan absensi.');
      return;
    }
    if (students.length === 0) {
      setValidationMessage('Tidak ada siswa aktif pada kelas yang dipilih.');
      return;
    }

    const records: RecordAttendanceItem[] = students.map((student) => {
      const item = itemFor(student);
      return {
        student_id: student.student_id,
        status: item.status,
        keterangan: item.keterangan.trim() || undefined,
      };
    });

    const hasMissingNotes = records.some(
      (record) => record.status !== 'hadir' && (!record.keterangan || record.keterangan.trim().length === 0),
    );
    if (hasMissingNotes) {
      setValidationMessage('Keterangan wajib diisi untuk siswa yang Sakit, Izin, atau Alpha.');
      return;
    }

    await onSubmit({ tanggal: data.tanggal, kelas: data.kelas, records });
    handleClose();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-hidden border-hairline bg-surface-1 text-ink">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-2">
              <CalendarCheck size={18} className="text-semantic-success" aria-hidden="true" />
              <DialogTitle className="text-ink text-base font-semibold">Input Absensi Siswa</DialogTitle>
            </div>
            <DialogDescription className="text-ink-subtle text-xs">
              Data dimuat 10 siswa per batch. Gulir daftar sampai selesai sebelum menyimpan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
            {Boolean(error) && (
              <div role="alert" className="shrink-0 rounded border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">
                {getErrorMessage(error)}
              </div>
            )}
            {rosterQuery.error && (
              <div role="alert" className="shrink-0 rounded border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">
                {getErrorMessage(rosterQuery.error)}
              </div>
            )}

            <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="tanggal" className="text-ink-muted text-xs">Tanggal Absensi *</Label>
                <Input id="tanggal" type="date" className="bg-surface-2 text-xs text-ink" {...form.register('tanggal')} />
              </div>
              <div className="space-y-1">
                <Label className="text-ink-muted text-xs">Pilih Kelas *</Label>
                <Select value={selectedKelas} onValueChange={(value) => { if (value) handleClassChange(value); }}>
                  <SelectTrigger className="bg-surface-2 text-xs text-ink">
                    <SelectValue placeholder="Pilih Kelas" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-3 text-ink">
                    {classChoices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between text-[11px] text-ink-muted" aria-live="polite">
              <span>{loadedStudents} dari {rosterQuery.isLoading ? '…' : totalStudents} siswa dimuat</span>
              {rosterQuery.isFetchingNextPage && <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" />Memuat berikutnya...</span>}
            </div>

            <div
              className="min-h-0 flex-1 space-y-2 overflow-y-auto border-y border-hairline py-2 pr-1"
              onScroll={(event) => {
                const element = event.currentTarget;
                if (rosterQuery.hasNextPage && !rosterQuery.isFetchingNextPage && element.scrollTop + element.clientHeight >= element.scrollHeight - 64) {
                  void rosterQuery.fetchNextPage();
                }
              }}
              aria-busy={rosterQuery.isLoading || rosterQuery.isFetchingNextPage}
            >
              {rosterQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-semantic-success" aria-label="Memuat siswa" /></div>
              ) : students.length === 0 ? (
                <p className="py-6 text-center text-xs italic text-ink-tertiary">Tidak ada siswa aktif untuk kelas ini.</p>
              ) : (
                students.map((student) => {
                  const item = itemFor(student);
                  const isNotesRequired = item.status !== 'hadir';
                  return (
                    <div key={student.student_id} className="flex flex-col items-stretch justify-between gap-2 rounded border border-hairline/60 bg-surface-2/60 p-2.5 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-ink">{student.nama}</p>
                        <p className="text-[10px] text-ink-tertiary">{student.nis} · {student.kelas}</p>
                      </div>
                      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                        <Select value={item.status} onValueChange={(value) => { if (isOneOf(value, ATTENDANCE_STATUS_VALUES)) handleStatusChange(student.student_id, value); }}>
                          <SelectTrigger className="w-full bg-surface-1 text-xs text-ink sm:w-28"><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent className="bg-surface-3 text-ink">
                            <SelectItem value="hadir">Hadir</SelectItem>
                            <SelectItem value="sakit">Sakit</SelectItem>
                            <SelectItem value="izin">Izin</SelectItem>
                            <SelectItem value="alpha">Alpha</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder={isNotesRequired ? 'Keterangan wajib*' : 'Catatan opsional'}
                          value={item.keterangan}
                          onChange={(event) => handleKeteranganChange(student.student_id, event.target.value)}
                          className={cn('w-full bg-surface-1 text-xs text-ink sm:w-40', isNotesRequired && !item.keterangan && 'border-semantic-warning placeholder:text-semantic-warning')}
                        />
                      </div>
                    </div>
                  );
                })
              )}
              {rosterQuery.hasNextPage && !rosterQuery.isFetchingNextPage && (
                <Button type="button" variant="outline" size="sm" onClick={() => void rosterQuery.fetchNextPage()} className="mx-auto flex h-9 gap-1 text-xs">
                  <ChevronDown size={14} aria-hidden="true" /> Muat 10 siswa lagi
                </Button>
              )}
            </div>

            {rosterQuery.hasNextPage && (
              <p className="shrink-0 text-[11px] text-semantic-warning">Muat/Scroll semua siswa sebelum menyimpan agar tidak ada absensi siswa yang terlewat.</p>
            )}

            <DialogFooter className="shrink-0 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="h-9 bg-surface-2 text-xs text-ink">Batal</Button>
              <Button type="submit" disabled={isLoading || rosterQuery.isLoading || rosterQuery.hasNextPage || students.length === 0} className="h-9 bg-semantic-success text-xs font-medium text-white hover:bg-semantic-success/80">
                {isLoading ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Menyimpan...</> : 'Simpan Absensi Massal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <NoticeDialog
        open={Boolean(validationMessage)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setValidationMessage(null); }}
        title="Absensi Belum Lengkap"
        description={validationMessage ?? ''}
      />
    </>
  );
}
