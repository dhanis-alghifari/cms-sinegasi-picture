import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttendanceListRecord } from './attendance.helpers.js';
import { createAttendanceReadRepository } from './attendance.read.repository.js';
import { createAttendanceWriteRepository } from './attendance.write.repository.js';

export type AttendanceListQuery = {
  search?: string;
  kelas?: string;
  status?: string;
  tanggal?: string;
  date_from?: string;
  date_to?: string;
  student_id?: string;
  page: number;
  pageSize: number;
};

export type AttendanceSummaryQuery = {
  tanggal?: string;
  date_from?: string;
  date_to?: string;
  student_id?: string;
  kelas?: string;
  status?: string;
  search?: string;
};

export type AttendanceWriteInput = {
  studentId: string;
  tanggal: string;
  status: string;
  keterangan?: string;
  idempotencyKey: string;
  actorId: string;
};

export type AttendanceRosterQuery = {
  tanggal: string;
  kelas: string;
  page: number;
  pageSize: number;
};

export type AttendanceBatchWriteInput = {
  tanggal: string;
  kelas: string;
  records: Array<{
    student_id: string;
    status: string;
    keterangan?: string;
  }>;
  actorId: string;
  changeReason?: string;
};

export type AttendanceRosterRecord = {
  student_id: string;
  nis: string;
  nama: string;
  kelas: string;
  status?: string;
  keterangan?: string;
};

export type AttendanceCorrectionInput = {
  attendanceId: string;
  status: string;
  keterangan?: string;
  actorId: string;
  changeReason: string;
};

export type AttendanceSummary = {
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  total: number;
};

export type AttendanceRepositoryError = {
  code?: string;
  message?: string;
  details?: unknown;
  hint?: unknown;
} | null;

export interface AttendanceReadRepository {
  list(query: AttendanceListQuery): Promise<{ data: AttendanceListRecord[]; count: number; error: AttendanceRepositoryError }>;
  roster(query: AttendanceRosterQuery): Promise<{ data: AttendanceRosterRecord[]; count: number; error: AttendanceRepositoryError }>;
  summary(query: AttendanceSummaryQuery): Promise<{ data: AttendanceSummary | null; error: AttendanceRepositoryError }>;
}

export interface AttendanceWriteRepository {
  record(input: AttendanceWriteInput): Promise<{ data: Record<string, unknown> | null; error: AttendanceRepositoryError }>;
  batchRecord(input: AttendanceBatchWriteInput): Promise<{ data: Record<string, unknown>[]; error: AttendanceRepositoryError }>;
  correct(input: AttendanceCorrectionInput): Promise<{ data: Record<string, unknown> | null; error: AttendanceRepositoryError }>;
}

export interface AttendancePersistence {
  readonly read: AttendanceReadRepository;
  readonly write: AttendanceWriteRepository;
}

type SupabaseLike = SupabaseClient | null;

export function createAttendancePersistence(client: SupabaseLike): AttendancePersistence {
  return {
    read: createAttendanceReadRepository(client),
    write: createAttendanceWriteRepository(client),
  };
}
