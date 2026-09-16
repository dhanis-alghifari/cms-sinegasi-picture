
import { z } from 'zod';
import { apiClient } from '@/shared/api/client';
import { decodeWithSchema } from '@/shared/api/responseValidation';
import { toFiniteNumber } from '@/shared/utils/formatNumber';
import type {
  DashboardSummaryData,
  GradeDistributionSummary,
  KasSummary,
  StudentPersonalSummary,
} from '../types/dashboard.types';

type RecordValue = Record<string, unknown>;
type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'E';

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

function isGradeLetter(value: unknown): value is GradeLetter {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'E';
}

function numberValue(value: unknown): number | undefined {
  return toFiniteNumber(typeof value === 'string' || typeof value === 'number' ? value : undefined) ?? undefined;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function recordValue(value: unknown): RecordValue {
  return isRecord(value) ? value : {};
}

const dashboardTransactionSchema = z.object({
  id: z.string(),
  tipe: z.enum(['masuk', 'keluar']),
  jumlah: z.number(),
  keterangan: z.string(),
  tanggal: z.string(),
  studentNama: z.string().nullable().optional(),
}).loose();

const dashboardEnvelopeSchema = z.object({
  success: z.literal(true),
  scope: z.enum(['operational', 'personal']),
  role: z.string(),
  reportDate: z.string().optional(),
  timezone: z.string().optional(),
  kas: z.object({
    saldoTerakhir: z.number(),
    pemasukanBulanIni: z.number(),
    pengeluaranBulanIni: z.number(),
    transaksiTerbaru: z.array(dashboardTransactionSchema),
  }).loose(),
  absensi: z.object({
    hadir: z.number(),
    sakit: z.number(),
    izin: z.number(),
    alpha: z.number(),
    totalSiswa: z.number(),
    totalTercatat: z.number(),
    persentaseHadir: z.number(),
  }).loose(),
  alat: z.object({
    tersedia: z.number(),
    dipinjam: z.number(),
    maintenance: z.number(),
    rusak: z.number(),
    totalAlat: z.number(),
    overdueCount: z.number(),
  }).loose(),
  gradeDistribution: z.object({
    totalSiswaEvaluated: z.number(),
    distribution: z.object({
      A: z.number(),
      B: z.number(),
      C: z.number(),
      D: z.number(),
      E: z.number(),
    }).loose(),
  }).loose().optional(),
}).loose();

export const decodeDashboardResponse = decodeWithSchema(dashboardEnvelopeSchema);

function parseRecentTransactions(value: unknown): KasSummary['transaksiTerbaru'] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const transaction = recordValue(item);
    const tipe = transaction.tipe;
    if (
      typeof transaction.id !== 'string'
      || (tipe !== 'masuk' && tipe !== 'keluar')
      || typeof transaction.tanggal !== 'string'
    ) {
      return [];
    }

    const parsedTransaction: KasSummary['transaksiTerbaru'][number] = {
      id: transaction.id,
      tipe,
      jumlah: numberValue(transaction.jumlah) ?? 0,
      keterangan: stringValue(transaction.keterangan),
      tanggal: transaction.tanggal,
    };
    if (typeof transaction.studentNama === 'string') {
      parsedTransaction.studentNama = transaction.studentNama;
    }
    return [parsedTransaction];
  });
}

function parseGradeCounts(value: unknown): GradeDistributionSummary['distribution'] {
  const source = recordValue(value);
  return {
    A: numberValue(source.A) ?? 0,
    B: numberValue(source.B) ?? 0,
    C: numberValue(source.C) ?? 0,
    D: numberValue(source.D) ?? 0,
    E: numberValue(source.E) ?? 0,
  };
}

function parseGradeDistribution(value: unknown): DashboardSummaryData['gradeDistribution'] {
  if (!isRecord(value)) return undefined;

  const parsedDistribution: GradeDistributionSummary = {
    totalSiswaEvaluated: numberValue(value.totalSiswaEvaluated) ?? 0,
    distribution: parseGradeCounts(value.distribution),
  };
  const rawCategories = recordValue(value.byCategory);
  const byCategory: NonNullable<GradeDistributionSummary['byCategory']> = {};

  for (const [category, counts] of Object.entries(rawCategories)) {
    byCategory[category] = parseGradeCounts(counts);
  }
  if (Object.keys(byCategory).length > 0) {
    parsedDistribution.byCategory = byCategory;
  }

  return parsedDistribution;
}

function parseLatestGrade(value: unknown): StudentPersonalSummary['nilaiTerakhir'] {
  if (!isRecord(value)) return null;

  const nilai = isGradeLetter(value.nilai) ? value.nilai : 'E';
  const keterangan = typeof value.keterangan === 'string' ? value.keterangan : undefined;

  return {
    assignmentTitle: stringValue(value.assignmentTitle),
    nilai,
    category: stringValue(value.category),
    keterangan,
    tanggal: stringValue(value.tanggal),
  };
}

function parseStudentPersonalSummary(value: unknown): DashboardSummaryData['studentPersonal'] {
  if (!isRecord(value)) return undefined;

  const attendance = recordValue(value.kehadiran);
  const cash = recordValue(value.kas);
  const parsedLatestGrade = parseLatestGrade(value.nilaiTerakhir);

  const paymentHistory: StudentPersonalSummary['kas']['riwayatPembayaran'] = [];
  if (Array.isArray(cash.riwayatPembayaran)) {
    for (const item of cash.riwayatPembayaran) {
      const payment = recordValue(item);
      paymentHistory.push({
        ...(typeof payment.id === 'string' ? { id: payment.id } : {}),
        nominal: numberValue(payment.nominal) ?? 0,
        date: stringValue(payment.date),
        status: stringValue(payment.status),
        keterangan: stringValue(payment.keterangan),
      });
    }
  }

  return {
    kehadiran: {
      hadir: numberValue(attendance.hadir) ?? 0,
      sakit: numberValue(attendance.sakit) ?? 0,
      izin: numberValue(attendance.izin) ?? 0,
      alpha: numberValue(attendance.alpha) ?? 0,
      persentase: numberValue(attendance.persentase) ?? 0,
      total: numberValue(attendance.total) ?? 0,
    },
    kas: {
      totalTunggakan: numberValue(cash.totalTunggakan) ?? 0,
      totalDibayar: numberValue(cash.totalDibayar) ?? 0,
      jumlahPembayaran: numberValue(cash.jumlahPembayaran) ?? 0,
      statusPembayaranTerakhir: stringValue(cash.statusPembayaranTerakhir),
      riwayatPembayaran: paymentHistory,
    },
    nilaiTerakhir: parsedLatestGrade,
  };
}

function normalizeDashboardResponse(payload: unknown): DashboardSummaryData {
  const response = decodeDashboardResponse(payload);
  const root = response;
  const kas = recordValue(root.kas);
  const absensi = recordValue(root.absensi);
  const alat = recordValue(root.alat);
  const rawGradeDistribution = root.gradeDistribution;

  const normalized: DashboardSummaryData = {
    scope: root.scope === 'personal' || root.scope === 'operational' ? root.scope : undefined,
    role: typeof root.role === 'string' ? root.role : undefined,
    reportDate: typeof root.reportDate === 'string' ? root.reportDate : undefined,
    timezone: typeof root.timezone === 'string' ? root.timezone : undefined,
    kas: {
      saldoTerakhir: numberValue(root.kasBalance) ?? numberValue(kas.saldoTerakhir) ?? 0,
      pemasukanBulanIni: numberValue(kas.pemasukanBulanIni) ?? 0,
      pengeluaranBulanIni: numberValue(kas.pengeluaranBulanIni) ?? 0,
      transaksiTerbaru: parseRecentTransactions(kas.transaksiTerbaru),
    },
    absensi: {
      hadir: numberValue(absensi.hadir),
      sakit: numberValue(absensi.sakit),
      izin: numberValue(absensi.izin),
      alpha: numberValue(absensi.alpha),
      totalSiswa: numberValue(root.totalSiswa) ?? numberValue(absensi.totalSiswa) ?? 0,
      totalTercatat: numberValue(absensi.totalTercatat),
      persentaseHadir: numberValue(root.attendanceTodayPercentage)
        ?? numberValue(absensi.persentaseHadir)
        ?? numberValue(absensi.persentaseKehadiran)
        ?? 0,
    },
    alat: {
      tersedia: numberValue(alat.tersedia),
      dipinjam: numberValue(alat.dipinjam),
      maintenance: numberValue(alat.maintenance),
      rusak: numberValue(alat.rusak),
      totalAlat: numberValue(root.totalAlat) ?? numberValue(alat.totalAlat) ?? 0,
      overdueCount: numberValue(alat.overdueCount),
    },
  };

  const gradeDistribution = parseGradeDistribution(rawGradeDistribution);
  if (gradeDistribution) normalized.gradeDistribution = gradeDistribution;

  const studentPersonal = parseStudentPersonalSummary(root.studentPersonal);
  if (studentPersonal) normalized.studentPersonal = studentPersonal;

  return normalized;
}

export const dashboardService = {
  async getSummary(): Promise<DashboardSummaryData> {
    return apiClient.getParsed('/api/dashboard/summary', normalizeDashboardResponse);
  },
};
