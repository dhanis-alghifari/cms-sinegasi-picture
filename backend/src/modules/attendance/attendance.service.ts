import type {
  AttendanceBatchWriteInput,
  AttendanceCorrectionInput,
  AttendanceListQuery,
  AttendanceRosterQuery,
  AttendanceRepository,
  AttendanceWriteInput,
} from './attendance.repository.js';

export class AttendanceServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
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

  async summary(tanggal?: string, studentId?: string) {
    const result = await this.repository.summary(tanggal, studentId);
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

    const result = await this.repository.batchRecord(input);
    if (result.error || result.data.length !== input.records.length) {
      const code = result.error?.code;
      const statusCode = code === '23505' ? 409 : ['22023', 'P0001'].includes(code || '') ? 422 : 400;
      throw new AttendanceServiceError(statusCode, 'BATCH_RECORD_FAILED', 'Gagal mencatat absensi massal.');
    }
    return { data: result.data, total: result.data.length, tanggal: input.tanggal, kelas: input.kelas };
  }

  async correct(input: AttendanceCorrectionInput) {
    const result = await this.repository.correct(input);
    if (result.error || !result.data) {
      const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 400;
      throw new AttendanceServiceError(statusCode, 'CORRECTION_FAILED', statusCode === 404
        ? 'Record absensi tidak ditemukan.'
        : 'Gagal mengoreksi data presensi.');
    }
    return result.data;
  }
}
