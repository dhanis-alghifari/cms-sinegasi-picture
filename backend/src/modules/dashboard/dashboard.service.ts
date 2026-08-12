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
    kehadiranBulanIni: {
      hadir: number;
      sakit: number;
      izin: number;
      alpha: number;
      persentase: number;
    };
    tunggakanKas: { totalTunggakan: number; statusPembayaranTerakhir: string };
    nilaiTerakhir: {
      assignmentTitle: string;
      nilai: 'A' | 'B' | 'C' | 'D' | 'E';
      category: string;
      tanggal: string;
    } | null;
    peminjamanAktif: Array<{ id: string; namaAlat: string; dueAt: string; isOverdue: boolean }>;
    tugasLomba: Array<{ id: string; namaFestival: string; roleInContest: string; status: string }>;
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
      return {
        scope: 'operational',
        role: user.role,
        kas: { saldoTerakhir: 0, pemasukanBulanIni: 0, pengeluaranBulanIni: 0, transaksiTerbaru: [] },
        absensi: { hadir: 0, sakit: 0, izin: 0, alpha: 0, totalSiswa: 0, persentaseHadir: 0 },
        alat: { tersedia: 0, dipinjam: 0, maintenance: 0, rusak: 0, totalAlat: 0, overdueCount: 0 },
        gradeDistribution: {
          totalSiswaEvaluated: 0,
          distribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
        },
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
        persentaseHadir: summary.attendance.persentase,
      },
      alat: {
        tersedia: 0,
        dipinjam: summary.activeBorrowings.length,
        maintenance: 0,
        rusak: 0,
        totalAlat: summary.activeBorrowings.length,
        overdueCount: summary.activeBorrowings.filter((item) => item.isOverdue).length,
      },
      studentPersonal: {
        kehadiranBulanIni: {
          hadir: summary.attendance.hadir,
          sakit: summary.attendance.sakit,
          izin: summary.attendance.izin,
          alpha: summary.attendance.alpha,
          persentase: summary.attendance.persentase,
        },
        tunggakanKas: {
          totalTunggakan: summary.cash.totalTunggakan,
          statusPembayaranTerakhir: summary.cash.statusPembayaranTerakhir,
        },
        nilaiTerakhir: latestGrade && grade
          ? { assignmentTitle: latestGrade.taskTitle, nilai: grade, category: latestGrade.category, tanggal: latestGrade.date }
          : null,
        peminjamanAktif: summary.activeBorrowings.map((item, index) => ({
          id: `${summary.studentId}:borrowing:${index}`,
          ...item,
        })),
        tugasLomba: summary.contestTasks.map((item, index) => ({
          id: `${summary.studentId}:contest:${index}`,
          namaFestival: item.namaContest,
          roleInContest: item.role,
          status: item.status,
        })),
      },
    };
  }
}
