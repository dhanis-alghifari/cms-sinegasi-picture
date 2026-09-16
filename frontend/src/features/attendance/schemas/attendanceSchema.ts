
import { z } from 'zod';
import { ATTENDANCE_STATUS_VALUES } from '../types/attendance.types';

export const attendanceStatusEnum = z.enum(ATTENDANCE_STATUS_VALUES, { error: 'Status kehadiran wajib dipilih.' });

export const singleAttendanceItemSchema = z
  .object({
    student_id: z.string({ error: 'Siswa wajib dipilih.' }).min(1, 'Siswa wajib dipilih'),
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
  tanggal: z.string({ error: 'Tanggal absensi wajib diisi.' }).min(1, 'Tanggal absensi wajib diisi'),
  kelas: z.string({ error: 'Kelas wajib dipilih.' }).min(1, 'Kelas wajib diisi'),
});

export type BatchAttendanceFormValues = z.infer<typeof batchAttendanceSchema>;

export const correctAttendanceSchema = z
  .object({
    status: attendanceStatusEnum,
    keterangan: z.string().optional(),
    change_reason: z.string({ error: 'Alasan koreksi absensi wajib diisi.' }).min(5, 'Alasan koreksi absensi minimal 5 karakter'),
  })
  .superRefine((data, context) => {
    if (data.status !== 'hadir' && !data.keterangan?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['keterangan'],
        message: 'Keterangan wajib diisi untuk Sakit, Izin, atau Alpha',
      });
    }
  });

export type CorrectAttendanceFormValues = z.infer<typeof correctAttendanceSchema>;
