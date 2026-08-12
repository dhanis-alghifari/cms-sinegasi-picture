import type { DashboardMemoryState, DashboardSummary } from './dashboard.types.js';

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
    },
    cash: {
      totalTunggakan: 0,
      statusPembayaranTerakhir: 'LUNAS (Agustus 2026)',
      riwayat: [
        { nominal: 50000, date: '2026-08-04', status: 'lunas', keterangan: 'Iuran Kas Bulanan' },
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

export function normalizeDashboardStudentId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const studentId = value.trim();
  if (studentId.length === 0 || studentId.length > 128 || /[\u0000-\u001f\u007f]/.test(studentId)) return '';
  return studentId;
}
