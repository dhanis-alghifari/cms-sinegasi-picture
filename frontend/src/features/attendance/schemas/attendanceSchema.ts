// src/features/attendance/schemas/attendanceSchema.ts
// Zod validation schemas for attendance recording and correction

import { z } from 'zod';
import { ATTENDANCE_STATUS_VALUES } from '../types/attendance.types';

export const attendanceStatusEnum = z.enum(ATTENDANCE_STATUS_VALUES);

export const singleAttendanceItemSchema = z
  .object({
    student_id: z.string().min(1, 'Siswa wajib dipilih'),
    status: attendanceStatusEnum,
    keterangan: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.status !== 'hadir' && (!data.keterangan || data.keterangan.trim().length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Keterangan wajib diisi untuk status Sakit, Izin, atau Alpha',
      path: ['keterangan'],
    },
  );

export const batchAttendanceSchema = z.object({
  tanggal: z.string().min(1, 'Tanggal absensi wajib diisi'),
  kelas: z.string().min(1, 'Kelas wajib diisi'),
});

export type BatchAttendanceFormValues = z.infer<typeof batchAttendanceSchema>;

export const correctAttendanceSchema = z.object({
  status: attendanceStatusEnum,
  keterangan: z.string().optional(),
  change_reason: z.string().min(5, 'Alasan koreksi absensi terkunci wajib diisi (minimal 5 karakter)'),
});

export type CorrectAttendanceFormValues = z.infer<typeof correctAttendanceSchema>;
