// src/features/attendance/components/RecordAttendanceModal.tsx
// Batch Attendance Entry Modal for Secretary / Teacher
// PRD Rule: Keterangan is MANDATORY for Sakit, Izin, and Alpha status

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck, Loader2 } from 'lucide-react';

import { NoticeDialog } from '@/components/common/ActionDialog';
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
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/shared/api/errors';

import { batchAttendanceSchema, type BatchAttendanceFormValues } from '../schemas/attendanceSchema';
import type { AttendanceStatus, RecordAttendanceItem } from '../types/attendance.types';

interface StudentOption {
  id: string;
  nama: string;
  kelas: string;
}

interface RecordAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentOption[];
  onSubmit: (values: { tanggal: string; kelas: string; records: RecordAttendanceItem[] }) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function RecordAttendanceModal({
  open,
  onOpenChange,
  students,
  onSubmit,
  isLoading,
  error,
}: RecordAttendanceModalProps) {
  const [selectedKelas, setSelectedKelas] = useState('X');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; keterangan: string }>>({});
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const filteredStudents = students.filter((s) => (
    selectedKelas === 'all'
      || s.kelas === selectedKelas
      || s.kelas.startsWith(`${selectedKelas} `)
  ));

  const form = useForm<BatchAttendanceFormValues>({
    resolver: zodResolver(batchAttendanceSchema),
    defaultValues: {
      tanggal: new Date().toISOString().split('T')[0],
      kelas: 'X',
    },
  });

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

  const handleSubmit = form.handleSubmit(async (data) => {
    // Validate mandatory notes for Sakit/Izin/Alpha
    const records: RecordAttendanceItem[] = filteredStudents.map((s) => {
      const item = attendanceMap[s.id] ?? { status: 'hadir', keterangan: '' };
      return {
        student_id: s.id,
        status: item.status,
        keterangan: item.keterangan || undefined,
      };
    });

    const hasMissingNotes = records.some(
      (r) => r.status !== 'hadir' && (!r.keterangan || r.keterangan.trim().length === 0),
    );

    if (hasMissingNotes) {
      setValidationMessage('Keterangan wajib diisi untuk siswa yang Sakit, Izin, atau Alpha.');
      return;
    }

    await onSubmit({
      tanggal: data.tanggal,
      kelas: data.kelas,
      records,
    });

    handleClose();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-hidden border-hairline bg-surface-1 text-ink">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck size={18} className="text-semantic-success" />
            <DialogTitle className="text-ink text-base font-semibold">Input Absensi Siswa</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Catat kehadiran siswa secara massal per kelas. Keterangan WAJIB diisi untuk Sakit, Izin, atau Alpha.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-hidden flex flex-col">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs shrink-0">
              {getErrorMessage(error)}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 shrink-0 sm:grid-cols-2">
            {/* Tanggal */}
            <div className="space-y-1">
              <Label htmlFor="tanggal" className="text-ink-muted text-xs">Tanggal Absensi *</Label>
              <Input
                id="tanggal"
                type="date"
                className="bg-surface-2 border-hairline text-ink text-xs h-9"
                {...form.register('tanggal')}
              />
            </div>

            {/* Kelas Selector */}
            <div className="space-y-1">
              <Label className="text-ink-muted text-xs">Pilih Kelas *</Label>
              <Select
                value={selectedKelas}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedKelas(val);
                    form.setValue('kelas', val);
                  }
                }}
              >
                <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs h-9">
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent className="bg-surface-3 border-hairline text-ink">
                  <SelectItem value="X">Kelas X</SelectItem>
                  <SelectItem value="XI">Kelas XI</SelectItem>
                  <SelectItem value="XII">Kelas XII</SelectItem>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Student Batch List */}
          <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1 border-t border-b border-hairline py-2 my-1">
            {filteredStudents.length === 0 ? (
              <p className="text-center text-ink-tertiary text-xs py-6 italic">
                Tidak ada siswa terdaftar untuk kelas ini.
              </p>
            ) : (
              filteredStudents.map((s) => {
                const item = attendanceMap[s.id] ?? { status: 'hadir', keterangan: '' };
                const isNotesRequired = item.status !== 'hadir';

                return (
                  <div key={s.id} className="p-2.5 rounded bg-surface-2/60 border border-hairline/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-ink font-semibold text-xs truncate">{s.nama}</p>
                      <p className="text-ink-tertiary text-[10px]">{s.kelas}</p>
                    </div>

                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      {/* Status select */}
                      <Select
                        value={item.status}
                        onValueChange={(val) => val && handleStatusChange(s.id, val as AttendanceStatus)}
                      >
                        <SelectTrigger className="w-full bg-surface-1 border-hairline text-ink text-xs h-8 sm:w-28">
                          <SelectValue placeholder="Pilih status kehadiran" />
                        </SelectTrigger>
                        <SelectContent className="bg-surface-3 border-hairline text-ink">
                          <SelectItem value="hadir">Hadir</SelectItem>
                          <SelectItem value="sakit">Sakit</SelectItem>
                          <SelectItem value="izin">Izin</SelectItem>
                          <SelectItem value="alpha">Alpha</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Notes input */}
                      <Input
                        placeholder={isNotesRequired ? 'Keterangan wajib*' : 'Catatan opsional'}
                        value={item.keterangan}
                        onChange={(e) => handleKeteranganChange(s.id, e.target.value)}
                        className={cn(
                          'w-full bg-surface-1 border-hairline text-ink text-xs h-8 sm:w-40',
                          isNotesRequired && !item.keterangan && 'border-semantic-warning placeholder:text-semantic-warning',
                        )}
                      />
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
            <Button type="submit" disabled={isLoading || filteredStudents.length === 0} className="bg-semantic-success hover:bg-semantic-success/80 text-white text-xs h-9 font-medium">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Absensi Massal'
              )}
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>

      <NoticeDialog
        open={Boolean(validationMessage)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setValidationMessage(null);
        }}
        title="Keterangan Belum Lengkap"
        description={validationMessage ?? ''}
      />
    </>
  );
}
