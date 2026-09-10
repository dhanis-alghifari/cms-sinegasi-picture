import { normalizeDashboardStudentId } from './dashboard.helpers.js';
import type { DashboardRepository } from './dashboard.types.js';
import type { JwtPayload } from '../../shared/auth/auth.types.js';

type DashboardScope = 'operational' | 'personal';

export type DashboardApiSummary = {
  scope: DashboardScope;
  role: JwtPayload['role'];
  studentId?: string;
  profile?: Record<string, unknown>;
  kas: {
    saldoTerakhir: number;
    pemasukanBulanIni: number;
    pengeluaranBulanIni: number;
    transaksiTerbaru: Array<Record<string, unknown>>;
  };
  absensi: {
    hadir: number;
    sakit: number;
    izin: number;
    alpha: number;
    totalSiswa: number;
    totalTercatat: number;
    persentaseHadir: number;
  };
  alat: {
    tersedia: number;
    dipinjam: number;
    maintenance: number;
    rusak: number;
    totalAlat: number;
    overdueCount: number;
  };
  gradeDistribution?: {
    totalSiswaEvaluated: number;
    distribution: { A: number; B: number; C: number; D: number; E: number };
  };
  studentPersonal?: {
    kehadiran: {
      hadir: number;
      sakit: number;
      izin: number;
      alpha: number;
      persentase: number;
      total: number;
    };
    kas: {
      totalTunggakan: number;
      totalDibayar: number;
      jumlahPembayaran: number;
      statusPembayaranTerakhir: string;
      riwayatPembayaran: Array<{ id?: string; nominal: number; date: string; status: string; keterangan: string }>;
    };
    nilaiTerakhir: {
      assignmentTitle: string;
      nilai: 'A' | 'B' | 'C' | 'D' | 'E';
      category: string;
      tanggal: string;
    } | null;
  };
};

export class DashboardServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'DashboardServiceError';
  }
}

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async getStudentSummary(studentId: unknown) {
    const normalizedId = normalizeDashboardStudentId(studentId);
    if (!normalizedId) {
      throw new DashboardServiceError(422, 'INVALID_STUDENT_ID', 'ID siswa tidak valid.');
    }

    const result = await this.repository.getStudentSummary(normalizedId);
    if ('error' in result) {
      throw new DashboardServiceError(503, 'DASHBOARD_UNAVAILABLE', 'Ringkasan dashboard belum tersedia.');
    }
    return result.data;
  }

  /**
   * Returns one stable response contract for the frontend. Teachers receive
   * an operational scope; every other approved role receives only their own
   * student read model and never another student's summary.
   */
  async getSummaryForUser(user: JwtPayload): Promise<DashboardApiSummary> {
    if (user.role === 'teacher') {
      const result = await this.repository.getOperationalSummary();
      if ('error' in result) {
        throw new DashboardServiceError(503, 'DASHBOARD_UNAVAILABLE', 'Ringkasan dashboard belum tersedia.');
      }

      return {
        scope: 'operational',
        role: user.role,
        ...result.data,
      };
    }

    const studentId = user.studentId || user.userId;
    const summary = await this.getStudentSummary(studentId);
    const latestGrade = summary.grades.terakhir[0];
    const grade = ['A', 'B', 'C', 'D', 'E'].includes(latestGrade?.grade || '')
      ? latestGrade.grade as 'A' | 'B' | 'C' | 'D' | 'E'
      : null;

    return {
      scope: 'personal',
      role: user.role,
      studentId: summary.studentId,
      profile: summary.profile,
      kas: { saldoTerakhir: 0, pemasukanBulanIni: 0, pengeluaranBulanIni: 0, transaksiTerbaru: [] },
      absensi: {
        hadir: summary.attendance.hadir,
        sakit: summary.attendance.sakit,
        izin: summary.attendance.izin,
        alpha: summary.attendance.alpha,
        totalSiswa: 1,
        totalTercatat: summary.attendance.total ?? summary.attendance.hadir + summary.attendance.sakit + summary.attendance.izin + summary.attendance.alpha,
        persentaseHadir: summary.attendance.persentase,
      },
      alat: { tersedia: 0, dipinjam: 0, maintenance: 0, rusak: 0, totalAlat: 0, overdueCount: 0 },
      studentPersonal: {
        kehadiran: {
          hadir: summary.attendance.hadir,
          sakit: summary.attendance.sakit,
          izin: summary.attendance.izin,
          alpha: summary.attendance.alpha,
          persentase: summary.attendance.persentase,
          total: summary.attendance.total ?? summary.attendance.hadir + summary.attendance.sakit + summary.attendance.izin + summary.attendance.alpha,
        },
        kas: {
          totalTunggakan: summary.cash.totalTunggakan,
          totalDibayar: summary.cash.totalDibayar,
          jumlahPembayaran: summary.cash.jumlahPembayaran,
          statusPembayaranTerakhir: summary.cash.statusPembayaranTerakhir,
          riwayatPembayaran: summary.cash.riwayat,
        },
        nilaiTerakhir: latestGrade && grade
          ? { assignmentTitle: latestGrade.taskTitle, nilai: grade, category: latestGrade.category, tanggal: latestGrade.date }
          : null,
      },
    };
  }
}
