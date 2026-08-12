// src/features/dashboard/services/dashboard.service.ts
// Pure TS dashboard service — fetch dashboard summary from backend

import { apiClient } from '@/shared/api/client';
import { toFiniteNumber } from '@/shared/utils/formatNumber';
import type { DashboardSummaryData, KasSummary } from '../types/dashboard.types';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

function numberValue(value: unknown): number | undefined {
  return toFiniteNumber(typeof value === 'string' || typeof value === 'number' ? value : undefined) ?? undefined;
}

function recordValue(value: unknown): RecordValue {
  return isRecord(value) ? value : {};
}

function normalizeDashboardResponse(payload: unknown): DashboardSummaryData {
  const response = recordValue(payload);
  const root = isRecord(response.data) ? response.data : response;
  const kas = recordValue(root.kas);
  const absensi = recordValue(root.absensi);
  const alat = recordValue(root.alat);
  const rawGradeDistribution = root.gradeDistribution;

  const normalized: DashboardSummaryData = {
    scope: root.scope === 'personal' || root.scope === 'operational' ? root.scope : undefined,
    role: typeof root.role === 'string' ? root.role : undefined,
    kas: {
      saldoTerakhir: numberValue(root.kasBalance) ?? numberValue(kas.saldoTerakhir) ?? 0,
      pemasukanBulanIni: numberValue(kas.pemasukanBulanIni) ?? 0,
      pengeluaranBulanIni: numberValue(kas.pengeluaranBulanIni) ?? 0,
      transaksiTerbaru: Array.isArray(kas.transaksiTerbaru) ? kas.transaksiTerbaru as KasSummary['transaksiTerbaru'] : [],
    },
    absensi: {
      hadir: numberValue(absensi.hadir),
      sakit: numberValue(absensi.sakit),
      izin: numberValue(absensi.izin),
      alpha: numberValue(absensi.alpha),
      totalSiswa: numberValue(root.totalSiswa) ?? numberValue(absensi.totalSiswa) ?? 0,
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

  if (isRecord(rawGradeDistribution)) {
    normalized.gradeDistribution = rawGradeDistribution as unknown as DashboardSummaryData['gradeDistribution'];
  }
  if (isRecord(root.studentPersonal)) {
    normalized.studentPersonal = root.studentPersonal as unknown as DashboardSummaryData['studentPersonal'];
  }

  return normalized;
}

export const dashboardService = {
  async getSummary(): Promise<DashboardSummaryData> {
    const response = await apiClient.get<unknown>('/api/dashboard/summary');
    return normalizeDashboardResponse(response);
  },
};
