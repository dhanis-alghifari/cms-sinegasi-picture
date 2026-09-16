import type { DashboardSummary, OperationalDashboardSummary } from './dashboard.types.js';

export function createTestDashboardSummary(studentId: string): DashboardSummary {
  return {
    studentId,
    profile: { nama: 'Test Student', nisn: 'test-nisn', kelas: 'X', jurusan: 'Sinematografi', fotoUrl: '', waliKelas: '' },
    attendance: { persentase: 95, hadir: 38, sakit: 1, izin: 1, alpha: 0, total: 40 },
    cash: {
      totalTunggakan: 0,
      totalDibayar: 50000,
      jumlahPembayaran: 1,
      statusPembayaranTerakhir: 'lunas',
      riwayat: [{ id: `${studentId}:payment:1`, nominal: 50000, date: '2026-08-04', status: 'lunas', keterangan: 'Iuran test' }],
    },
    grades: { rataRata: 92.5, predikat: 'A', terakhir: [{ taskTitle: 'Tugas test', grade: 'A', category: 'class_task', date: '2026-08-01' }] },
    activeBorrowings: [],
    contestTasks: [],
  };
}

export function createTestOperationalDashboardSummary(): OperationalDashboardSummary {
  return {
    reportDate: '2026-09-09',
    timezone: 'Asia/Jakarta',
    kas: { saldoTerakhir: 80002, pemasukanBulanIni: 3000, pengeluaranBulanIni: 6000, transaksiTerbaru: [] },
    absensi: { hadir: 4, sakit: 0, izin: 0, alpha: 0, totalSiswa: 20, totalTercatat: 4, persentaseHadir: 100 },
    alat: { tersedia: 1, dipinjam: 0, maintenance: 0, rusak: 0, totalAlat: 1, overdueCount: 0 },
    gradeDistribution: { totalSiswaEvaluated: 5, distribution: { A: 3, B: 1, C: 1, D: 0, E: 0 } },
  };
}
