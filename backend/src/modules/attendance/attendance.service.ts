import type {
  AttendanceCorrectionInput,
  AttendanceListQuery,
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

  async summary(tanggal: string) {
    const result = await this.repository.summary(tanggal);
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
