import type { DashboardMemoryState, DashboardSummary, OperationalDashboardSummary } from './dashboard.types.js';

export function createDashboardMemoryState(): DashboardMemoryState {
  return { summaries: new Map() };
}

/**
 * Preserves the response that the legacy route returned while the real
 * dashboard read model is still being designed. Do not put credentials or
 * other secrets in this fixture.
 */
export function createDefaultDashboardSummary(studentId: string): DashboardSummary {
  return {
    studentId,
    profile: {
      nama: 'Budi Santoso',
      nisn: '20261001',
      kelas: 'XII DKV 1',
      jurusan: 'Desain Komunikasi Visual',
      fotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      waliKelas: 'Dra. Endang Rahayu, M.Pd',
    },
    attendance: {
      persentase: 95,
      hadir: 38,
      sakit: 1,
      izin: 1,
      alpha: 0,
      total: 40,
    },
    cash: {
      totalTunggakan: 0,
      totalDibayar: 50000,
      jumlahPembayaran: 1,
      statusPembayaranTerakhir: 'LUNAS (Agustus 2026)',
      riwayat: [
        { id: `${studentId}:payment:1`, nominal: 50000, date: '2026-08-04', status: 'lunas', keterangan: 'Iuran Kas Bulanan' },
      ],
    },
    grades: {
      rataRata: 92.5,
      predikat: 'A',
      terakhir: [
        {
          taskTitle: 'Sinematografi Dasar & Lighting Lab',
          grade: 'A',
          category: 'class_task',
          date: '2026-08-01',
        },
      ],
    },
    activeBorrowings: [
      { namaAlat: 'Kamera Sony Alpha A7 III', dueAt: '2026-08-08', isOverdue: false },
    ],
    contestTasks: [
      { namaContest: 'LKS Sinematografi Nasional 2026', role: 'DOP / Editor', status: 'progres' },
    ],
  };
}

export function createDefaultOperationalDashboardSummary(): OperationalDashboardSummary {
  return {
    reportDate: '2026-09-09',
    timezone: 'Asia/Jakarta',
    kas: {
      saldoTerakhir: 80002,
      pemasukanBulanIni: 3000,
      pengeluaranBulanIni: 6000,
      transaksiTerbaru: [],
    },
    absensi: {
      hadir: 4,
      sakit: 0,
      izin: 0,
      alpha: 0,
      totalSiswa: 20,
      totalTercatat: 4,
      persentaseHadir: 100,
    },
    alat: {
      tersedia: 1,
      dipinjam: 0,
      maintenance: 0,
      rusak: 0,
      totalAlat: 1,
      overdueCount: 0,
    },
    gradeDistribution: {
      totalSiswaEvaluated: 5,
      distribution: { A: 3, B: 1, C: 1, D: 0, E: 0 },
    },
  };
}

export function normalizeDashboardStudentId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const studentId = value.trim();
  if (studentId.length === 0 || studentId.length > 128 || /[\u0000-\u001f\u007f]/.test(studentId)) return '';
  return studentId;
}
