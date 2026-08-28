/**
 * Contract for the legacy student dashboard summary endpoint.
 *
 * The endpoint is currently backed by a development fixture. Keeping the
 * response model behind a module boundary lets us replace the fixture with a
 * query-backed repository without leaking data-access concerns into routes.
 */
export type DashboardSummary = {
  studentId: string;
  profile: {
    nama: string;
    nisn: string;
    kelas: string;
    jurusan: string;
    fotoUrl: string;
    waliKelas: string;
  };
  attendance: {
    persentase: number;
    hadir: number;
    sakit: number;
    izin: number;
    alpha: number;
    total?: number;
  };
  cash: {
    totalTunggakan: number;
    totalDibayar: number;
    jumlahPembayaran: number;
    statusPembayaranTerakhir: string;
    riwayat: Array<{
      id?: string;
      nominal: number;
      date: string;
      status: string;
      keterangan: string;
    }>;
  };
  grades: {
    rataRata: number;
    predikat: string;
    terakhir: Array<{
      taskTitle: string;
      grade: string;
      category: string;
      date: string;
    }>;
  };
  activeBorrowings: Array<{
    namaAlat: string;
    dueAt: string;
    isOverdue: boolean;
  }>;
  contestTasks: Array<{
    namaContest: string;
    role: string;
    status: string;
  }>;
};

export type DashboardMemoryState = {
  summaries: Map<string, DashboardSummary>;
};

export type DashboardRepositoryResult<T> =
  | { data: T; error?: never }
  | { data?: null; error: unknown };

export interface DashboardRepository {
  getStudentSummary(studentId: string): Promise<DashboardRepositoryResult<DashboardSummary>>;
}
