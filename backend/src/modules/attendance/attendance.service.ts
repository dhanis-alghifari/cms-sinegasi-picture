import type {
  AttendanceBatchWriteInput,
  AttendanceCorrectionInput,
  AttendanceListQuery,
  AttendanceRosterQuery,
  AttendanceRepository,
  AttendanceSummaryQuery,
  AttendanceWriteInput,
} from './attendance.repository.js';

export class AttendanceServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly databaseError?: {
      code?: string;
      message?: string;
      details?: unknown;
    },
  ) {
    super(message);
    this.name = 'AttendanceServiceError';
  }
}

export class AttendanceService {
  constructor(private readonly repository: AttendanceRepository) {}

  repositoryIsConfigured(): boolean {
    return this.repository.isConfigured();
  }

  async list(query: AttendanceListQuery) {
    this.validateDateFilter(query);
    const result = await this.repository.list(query);
    if (result.error) throw new AttendanceServiceError(500, 'LIST_FAILED', 'Gagal memuat data presensi.');
    return {
      data: result.data,
      total: result.count,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(result.count / query.pageSize) || 1,
    };
  }

  async roster(query: AttendanceRosterQuery) {
    const result = await this.repository.roster(query);
    if (result.error) throw new AttendanceServiceError(500, 'ROSTER_FAILED', 'Gagal memuat daftar siswa untuk absensi.');
    return {
      data: result.data,
      total: result.count,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(result.count / query.pageSize) || 1,
    };
  }

  async summary(query: AttendanceSummaryQuery) {
    this.validateDateFilter(query);
    const result = await this.repository.summary(query);
    if (result.error || !result.data) {
      throw new AttendanceServiceError(500, 'SUMMARY_FAILED', 'Gagal memuat ringkasan presensi.');
    }
    return result.data;
  }

  async record(input: Omit<AttendanceWriteInput, 'idempotencyKey'> & { idempotencyKey?: string }) {
    if (!input.studentId || !input.tanggal || !input.status) {
      throw new AttendanceServiceError(422, 'REQUIRED_FIELDS', 'student_id, tanggal, dan status wajib diisi.');
    }
    const result = await this.repository.record({
      ...input,
      idempotencyKey: input.idempotencyKey || `att-${input.studentId}-${input.tanggal}`,
    });
    if (result.error || !result.data) {
      const statusCode = result.error?.code === '23505' ? 409 : 400;
      throw new AttendanceServiceError(statusCode, 'RECORD_FAILED', 'Gagal mencatat presensi siswa.');
    }
    return result.data;
  }

  async batchRecord(input: AttendanceBatchWriteInput) {
    if (!input.tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(input.tanggal)) {
      throw new AttendanceServiceError(422, 'INVALID_DATE', 'Tanggal absensi tidak valid.');
    }
    if (!input.kelas || input.kelas.trim().toLowerCase() === 'all') {
      throw new AttendanceServiceError(422, 'INVALID_CLASS', 'Pilih satu kelas sebelum menyimpan absensi.');
    }
    if (input.records.length < 1 || input.records.length > 500) {
      throw new AttendanceServiceError(422, 'INVALID_RECORD_COUNT', 'Jumlah data absensi harus antara 1 dan 500 siswa.');
    }

    const seen = new Set<string>();
    for (const record of input.records) {
      if (!record.student_id || seen.has(record.student_id)) {
        throw new AttendanceServiceError(422, 'DUPLICATE_STUDENT', 'Setiap siswa hanya boleh muncul satu kali dalam batch.');
      }
      seen.add(record.student_id);
      if (!['hadir', 'sakit', 'izin', 'alpha'].includes(record.status)) {
        throw new AttendanceServiceError(422, 'INVALID_STATUS', 'Status absensi tidak valid.');
      }
      if (record.status !== 'hadir' && !record.keterangan?.trim()) {
        throw new AttendanceServiceError(422, 'REQUIRED_NOTE', 'Keterangan wajib diisi untuk Sakit, Izin, atau Alpha.');
      }
    }

    const result = await this.repository.batchRecord({
      ...input,
      changeReason: input.changeReason?.trim() || 'Mencatat absensi massal',
    });
    if (result.error || result.data.length !== input.records.length) {
      const code = result.error?.code;
      const statusCode = code === '23505' ? 409 : ['22023', 'P0001'].includes(code || '') ? 422 : 400;
      throw new AttendanceServiceError(
        statusCode,
        'BATCH_RECORD_FAILED',
        'Gagal mencatat absensi massal.',
        result.error
          ? {
              code: result.error.code,
              message: result.error.message,
              details: result.error.details,
            }
          : undefined,
      );
    }
    return { data: result.data, total: result.data.length, tanggal: input.tanggal, kelas: input.kelas };
  }

  async correct(input: AttendanceCorrectionInput) {
    const status = input.status.trim().toLowerCase();
    const note = input.keterangan?.trim() || undefined;
    const changeReason = input.changeReason?.trim() || '';

    if (!input.attendanceId || !input.actorId || !status) {
      throw new AttendanceServiceError(422, 'REQUIRED_FIELDS', 'ID presensi, actor, dan status wajib diisi.');
    }
    if (!['hadir', 'sakit', 'izin', 'alpha'].includes(status)) {
      throw new AttendanceServiceError(422, 'INVALID_STATUS', 'Status absensi tidak valid.');
    }
    if (status !== 'hadir' && !note) {
      throw new AttendanceServiceError(422, 'REQUIRED_NOTE', 'Keterangan wajib diisi untuk Sakit, Izin, atau Alpha.');
    }
    if (note && note.length > 500) {
      throw new AttendanceServiceError(422, 'NOTE_TOO_LONG', 'Keterangan maksimal 500 karakter.');
    }
    if (changeReason.length < 5 || changeReason.length > 500) {
      throw new AttendanceServiceError(422, 'CHANGE_REASON_REQUIRED', 'Alasan koreksi wajib diisi 5 sampai 500 karakter.');
    }

    const result = await this.repository.correct({
      ...input,
      status,
      keterangan: note,
      changeReason,
    });
    if (result.error || !result.data) {
      const code = result.error?.code;
      const statusCode = ['NOT_FOUND', 'P0002', 'PGRST116'].includes(code || '')
        ? 404
        : ['22023'].includes(code || '')
          ? 422
          : ['PGRST202', '42883', '42P01'].includes(code || '')
            ? 503
            : 400;
      throw new AttendanceServiceError(
        statusCode,
        statusCode === 404 ? 'ATTENDANCE_NOT_FOUND' : statusCode === 503 ? 'CORRECTION_UNAVAILABLE' : 'CORRECTION_FAILED',
        statusCode === 404
          ? 'Record absensi tidak ditemukan.'
          : statusCode === 503
            ? 'Fitur koreksi absensi belum tersedia di database.'
            : 'Gagal mengoreksi data presensi.',
        result.error
          ? {
              code: result.error.code,
              message: result.error.message,
              details: result.error.details,
            }
          : undefined,
      );
    }
    return result.data;
  }

  private validateDateFilter(query: {
    tanggal?: string;
    date_from?: string;
    date_to?: string;
  }): void {
    if (query.tanggal && (query.date_from || query.date_to)) {
      throw new AttendanceServiceError(422, 'INVALID_DATE_FILTER', 'Gunakan tanggal tunggal atau rentang tanggal, bukan keduanya.');
    }
    if (query.date_from && query.date_to && query.date_from > query.date_to) {
      throw new AttendanceServiceError(422, 'INVALID_DATE_RANGE', 'Tanggal mulai harus sama atau sebelum tanggal selesai.');
    }
  }
}
