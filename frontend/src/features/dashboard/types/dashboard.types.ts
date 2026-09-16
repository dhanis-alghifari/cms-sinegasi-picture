
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
  totalTercatat?: number;
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
    riwayatPembayaran: Array<{
      id?: string;
      nominal: number;
      date: string;
      status: string;
      keterangan: string;
    }>;
  };
  nilaiTerakhir: {
    assignmentTitle: string;
    nilai: 'A' | 'B' | 'C' | 'D' | 'E';
    category: string;
    keterangan?: string;
    tanggal: string;
  } | null;
}

export interface DashboardSummaryData {
  scope?: 'operational' | 'personal';
  role?: string;
  reportDate?: string;
  timezone?: string;
  kas?: KasSummary;
  absensi?: AbsensiSummary;
  alat?: AlatStatusSummary;
  gradeDistribution?: GradeDistributionSummary;
  studentPersonal?: StudentPersonalSummary;
}
