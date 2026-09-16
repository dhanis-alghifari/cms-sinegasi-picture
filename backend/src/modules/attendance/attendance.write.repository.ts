import type { SupabaseClient } from '@supabase/supabase-js';
import { mapAttendanceRow } from './attendance.helpers.js';
import type {
  AttendanceBatchWriteInput,
  AttendanceCorrectionInput,
  AttendanceRepositoryError,
  AttendanceWriteInput,
  AttendanceWriteRepository,
} from './attendance.repository.js';
import { ATTENDANCE_RECORD_SELECT, isDatabaseRow, toDatabaseRows } from './attendance.repository.shared.js';

type SupabaseLike = SupabaseClient | null;

type AttendanceRecordPayload = {
  student_id: string;
  tanggal: string;
  status: string;
  keterangan?: string;
};

function sameAttendancePayload(row: Record<string, unknown>, input: AttendanceRecordPayload): boolean {
  const existingNote = typeof row.keterangan === 'string' ? row.keterangan.trim() : '';
  const inputNote = input.keterangan?.trim() || '';
  return String(row.student_id) === input.student_id
    && String(row.tanggal) === input.tanggal
    && String(row.status) === input.status
    && existingNote === inputNote;
}

export function createAttendanceWriteRepository(client: SupabaseLike): AttendanceWriteRepository {
  return {
    async record(input: AttendanceWriteInput) {
      if (!client) {
        return {
          data: {
            id: `att-${Date.now()}`,
            student_id: input.studentId,
            tanggal: input.tanggal,
            status: input.status,
            keterangan: input.keterangan,
            idempotency_key: input.idempotencyKey,
          },
          error: null,
        };
      }
      const payload: AttendanceRecordPayload & Record<string, unknown> = {
        student_id: input.studentId,
        tanggal: input.tanggal,
        status: input.status,
        keterangan: input.keterangan,
        idempotency_key: input.idempotencyKey,
        created_by: input.actorId,
        updated_by: input.actorId,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client.from('attendance').insert([payload]).select(ATTENDANCE_RECORD_SELECT).single();
      if (error?.code !== '23505') {
        return {
          data: isDatabaseRow(data) ? mapAttendanceRow(data) : null,
          error: error || null,
        };
      }

      const replay = await client
        .from('attendance')
        .select(ATTENDANCE_RECORD_SELECT)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();
      if (replay.error) return { data: null, error: replay.error };
      if (!isDatabaseRow(replay.data)) {
        return { data: null, error: { code: '23505', message: 'Data presensi sudah tercatat.' } };
      }
      if (!sameAttendancePayload(replay.data, payload)) {
        return {
          data: null,
          error: {
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'Idempotency key sudah digunakan untuk data presensi yang berbeda.',
          },
        };
      }
      return {
        data: mapAttendanceRow(replay.data),
        error: null,
      };
    },

    async batchRecord(input: AttendanceBatchWriteInput) {
      if (!client) {
        return {
          data: input.records.map((record, index) => ({
            id: `att-${Date.now()}-${index}`,
            student_id: record.student_id,
            tanggal: input.tanggal,
            status: record.status,
            keterangan: record.keterangan,
            idempotency_key: `att-${record.student_id}-${input.tanggal}`,
          })),
          error: null,
        };
      }

      const result = await client.rpc('record_attendance_batch_atomic', {
        p_tanggal: input.tanggal,
        p_kelas: input.kelas,
        p_records: input.records,
        p_actor_id: input.actorId,
        p_change_reason: input.changeReason?.trim() || 'Mencatat absensi massal',
      });
      if (result.error) return { data: [], error: result.error };
      const payload = Array.isArray(result.data) ? result.data[0] : result.data;
      const rows = isDatabaseRow(payload) ? toDatabaseRows(payload.data) : [];
      return { data: rows, error: null };
    },

    async correct(input: AttendanceCorrectionInput) {
      if (!client) return { data: null, error: { code: 'NOT_FOUND', message: 'Record absensi tidak ditemukan.' } };
      const { data: rpcData, error } = await client.rpc('correct_attendance_atomic', {
        p_attendance_id: input.attendanceId,
        p_status: input.status,
        p_keterangan: input.keterangan?.trim() || null,
        p_actor_id: input.actorId,
        p_change_reason: input.changeReason,
      });
      const payload = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const data = isDatabaseRow(payload)
        ? mapAttendanceRow(payload)
        : null;
      return {
        data,
        error: error || null,
      };
    },
  };
}
