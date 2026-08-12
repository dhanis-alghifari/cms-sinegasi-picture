// src/features/attendance/components/CorrectAttendanceModal.tsx
// Teacher Correction Modal for 48h Locked Attendance Records
// PRD Rule: Only Teacher (Guru Pembina) can correct attendance records locked after 48 hours, requiring mandatory change_reason audit log

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Edit3, Loader2 } from 'lucide-react';

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
import { formatDateShort } from '@/shared/utils/formatDate';

import { correctAttendanceSchema, type CorrectAttendanceFormValues } from '../schemas/attendanceSchema';
import type { AttendanceRecord, AttendanceStatus } from '../types/attendance.types';

interface CorrectAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: AttendanceRecord | null;
  onSubmit: (values: CorrectAttendanceFormValues) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}

export function CorrectAttendanceModal({
  open,
  onOpenChange,
  record,
  onSubmit,
  isLoading,
  error,
}: CorrectAttendanceModalProps) {
  const form = useForm<CorrectAttendanceFormValues>({
    resolver: zodResolver(correctAttendanceSchema),
    defaultValues: {
      status: 'hadir',
      keterangan: '',
      change_reason: '',
    },
  });

  const selectedStatus = useWatch({
    control: form.control,
    name: 'status',
  });

  useEffect(() => {
    if (record) {
      form.reset({
        status: record.status,
        keterangan: record.keterangan ?? '',
        change_reason: '',
      });
    }
  }, [record, form, open]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
    onOpenChange(false);
  });

  // The modal can be mounted before a record is selected. Do not format an
  // empty date or render a correction form without a target record.
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-1 border-hairline text-ink max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Edit3 size={18} className="text-primary" />
            <DialogTitle className="text-ink text-base font-semibold">Koreksi Absensi Guru</DialogTitle>
          </div>
          <DialogDescription className="text-ink-subtle text-xs">
            Koreksi status kehadiran siswa <strong className="text-ink">{record.student_nama}</strong> ({formatDateShort(record.tanggal)}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {Boolean(error) && (
            <div role="alert" className="px-3 py-2 rounded bg-semantic-danger/10 border border-semantic-danger/30 text-semantic-danger text-xs">
              {getErrorMessage(error)}
            </div>
          )}

          {record.is_locked && (
            <div className="p-2.5 rounded bg-semantic-warning/15 border border-semantic-warning/30 text-semantic-warning text-xs flex items-center gap-2">
              <Lock size={14} className="shrink-0" />
              <span>
                Rekaman ini telah <strong>terkunci (&gt;48 jam)</strong>. Hanya Guru Pembina yang berhak melakukan perubahan dengan mencantumkan alasan audit.
              </span>
            </div>
          )}

          {/* Status Kehadiran Baru */}
          <div className="space-y-1">
            <Label className="text-ink-muted text-xs font-semibold">Status Kehadiran Baru *</Label>
            <Select
              value={selectedStatus}
              onValueChange={(val) => val && form.setValue('status', val as AttendanceStatus)}
            >
              <SelectTrigger className="bg-surface-2 border-hairline text-ink text-xs h-9">
                <SelectValue placeholder="Pilih status kehadiran" />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-hairline text-ink">
                <SelectItem value="hadir">Hadir</SelectItem>
                <SelectItem value="sakit">Sakit</SelectItem>
                <SelectItem value="izin">Izin</SelectItem>
                <SelectItem value="alpha">Alpha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Keterangan */}
          <div className="space-y-1">
            <Label htmlFor="keterangan" className="text-ink-muted text-xs">Catatan / Keterangan</Label>
            <Input
              id="keterangan"
              placeholder="Sebutkan alasan izin/sakit atau surat dokter..."
              className="bg-surface-2 border-hairline text-ink text-xs h-9"
              {...form.register('keterangan')}
            />
          </div>

          {/* Change Reason (Mandatory Audit Header) */}
          <div className="space-y-1 pt-2 border-t border-hairline">
            <Label htmlFor="change_reason" className="text-ink-muted text-xs font-semibold">
              Alasan Koreksi Guru (Audit Header) *
            </Label>
            <Input
              id="change_reason"
              placeholder="cth. Koreksi surat sakit yang terlambat diserahkan"
              className={cn('bg-surface-2 border-hairline text-ink text-xs h-9', form.formState.errors.change_reason && 'border-semantic-danger')}
              {...form.register('change_reason')}
            />
            {form.formState.errors.change_reason && (
              <p className="text-semantic-danger text-[10px]">{form.formState.errors.change_reason.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-surface-2 border-hairline text-ink text-xs h-9">
              Batal
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary-hover text-primary-foreground text-xs h-9 font-medium">
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Koreksi'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
