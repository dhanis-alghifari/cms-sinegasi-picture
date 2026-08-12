// src/features/dashboard/types/dashboard.types.ts
// Dashboard domain types according to PRD and 01-dashboard-utama.md

export interface KasSummary {
  saldoTerakhir: number;
  pemasukanBulanIni: number;
  pengeluaranBulanIni: number;
  transaksiTerbaru: Array<{
    id: string;
    tipe: 'masuk' | 'keluar';
    jumlah: number;
    keterangan: string;
    tanggal: string;
    studentNama?: string;
  }>;
}

export interface AbsensiSummary {
  hadir?: number;
  sakit?: number;
  izin?: number;
  alpha?: number;
  totalSiswa: number;
  persentaseHadir: number;
}

export interface AlatStatusSummary {
  tersedia?: number;
  dipinjam?: number;
  maintenance?: number;
  rusak?: number;
  totalAlat: number;
  overdueCount?: number;
}

export interface GradeDistributionSummary {
  totalSiswaEvaluated: number;
  distribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
  };
  byCategory?: Record<string, { A: number; B: number; C: number; D: number; E: number }>;
}

export interface StudentPersonalSummary {
  kehadiranBulanIni: {
    hadir: number;
    sakit: number;
    izin: number;
    alpha: number;
    persentase: number;
  };
  tunggakanKas: {
    totalTunggakan: number;
    statusPembayaranTerakhir: string;
    tanggalTerakhirBayar?: string;
  };
  nilaiTerakhir: {
    assignmentTitle: string;
    nilai: 'A' | 'B' | 'C' | 'D' | 'E';
    category: string;
    keterangan?: string;
    tanggal: string;
  } | null;
  peminjamanAktif: Array<{
    id: string;
    namaAlat: string;
    dueAt: string;
    isOverdue: boolean;
  }>;
  tugasLomba: Array<{
    id: string;
    namaFestival: string;
    roleInContest: string;
    status: string;
  }>;
}

export interface DashboardSummaryData {
  scope?: 'operational' | 'personal';
  role?: string;
  kas?: KasSummary;
  absensi?: AbsensiSummary;
  alat?: AlatStatusSummary;
  gradeDistribution?: GradeDistributionSummary;
  studentPersonal?: StudentPersonalSummary;
}
