import type { GradeLetter, StudentPklPeriod } from './grades.types.js';

const GRADE_POINTS: Record<GradeLetter, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const GRADE_LETTERS: readonly GradeLetter[] = ['A', 'B', 'C', 'D', 'E'];

export type ReportGradeEvidence = { nilai: GradeLetter; dueDate: string };
export type ReportAttendanceEvidence = { tanggal: string; status: 'hadir' | 'sakit' | 'izin' | 'alpha' };
export type ReportPeriodRange = { startDate: string; endDate: string };

export type CalculatedGradeReport = {
  predikat: GradeLetter | null;
  deskripsi: string;
  evidenceCount: number;
  hadirCount: number;
  sakitCount: number;
  izinCount: number;
  alphaCount: number;
  pklDays: number;
  attendancePercentage: number | null;
};

function dateValue(value: string): number {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}

function isWithin(value: string, startDate: string, endDate: string): boolean {
  const current = dateValue(value);
  return current >= dateValue(startDate) && current <= dateValue(endDate);
}

function isPklDate(value: string, periods: StudentPklPeriod[]): boolean {
  return periods.some((period) => period.status === 'approved' || period.status === 'completed'
    ? isWithin(value, period.start_date, period.end_date)
    : false);
}

function pklDaysInRange(periods: StudentPklPeriod[], range?: ReportPeriodRange): number {
  const coveredDates = new Set<string>();
  const rangeStart = range ? dateValue(range.startDate) : Number.NEGATIVE_INFINITY;
  const rangeEnd = range ? dateValue(range.endDate) : Number.POSITIVE_INFINITY;
  periods.filter((period) => period.status === 'approved' || period.status === 'completed').forEach((period) => {
    let cursor = Math.max(dateValue(period.start_date), rangeStart);
    const end = Math.min(dateValue(period.end_date), rangeEnd);
    while (Number.isFinite(cursor) && cursor <= end) {
      coveredDates.add(new Date(cursor).toISOString().slice(0, 10));
      cursor += 86_400_000;
    }
  });
  return coveredDates.size;
}

function degrade(letter: GradeLetter): GradeLetter {
  const index = GRADE_LETTERS.indexOf(letter);
  return GRADE_LETTERS[Math.min(GRADE_LETTERS.length - 1, index + 1)];
}

function averagePredikat(grades: ReportGradeEvidence[]): GradeLetter {
  const average = grades.reduce((total, grade) => total + GRADE_POINTS[grade.nilai], 0) / grades.length;
  if (average >= 4.5) return 'A';
  if (average >= 3.5) return 'B';
  if (average >= 2.5) return 'C';
  if (average >= 1.5) return 'D';
  return 'E';
}

export function calculateGradeReport(
  grades: ReportGradeEvidence[],
  attendance: ReportAttendanceEvidence[],
  pklPeriods: StudentPklPeriod[],
  range?: ReportPeriodRange,
): CalculatedGradeReport {
  const effectiveAttendance = attendance.filter((row) => !isPklDate(row.tanggal, pklPeriods));
  const counts = effectiveAttendance.reduce((result, row) => {
    result[row.status] += 1;
    return result;
  }, { hadir: 0, sakit: 0, izin: 0, alpha: 0 });
  const attendanceTotal = Object.values(counts).reduce((total, value) => total + value, 0);
  const attendancePercentage = attendanceTotal > 0
    ? Number((((counts.hadir + counts.sakit + counts.izin) / attendanceTotal) * 100).toFixed(2))
    : null;
  const pklDays = pklDaysInRange(pklPeriods, range);

  if (grades.length === 0) {
    return {
      predikat: null,
      deskripsi: 'Belum ada bukti penilaian tugas pada periode ini; laporan menunggu penilaian guru.',
      evidenceCount: 0,
      hadirCount: counts.hadir,
      sakitCount: counts.sakit,
      izinCount: counts.izin,
      alphaCount: counts.alpha,
      pklDays,
      attendancePercentage,
    };
  }

  const alphaRatio = attendanceTotal > 0 ? counts.alpha / attendanceTotal : 0;
  let predikat = averagePredikat(grades);
  if (predikat === 'A' && alphaRatio > 0.1) predikat = 'B';
  else if (alphaRatio > 0.25) predikat = degrade(predikat);

  const attendanceDescription = attendancePercentage === null
    ? 'presensi belum tercatat'
    : `kehadiran efektif ${attendancePercentage}%`;
  const pklDescription = pklDays > 0 ? `; ${pklDays} hari PKL tidak dihitung sebagai alpha` : '';
  const alphaDescription = counts.alpha > 0 ? `; ${counts.alpha} alpha` : '';

  return {
    predikat,
    deskripsi: `Predikat ${predikat} dari ${grades.length} bukti penilaian, ${attendanceDescription}${pklDescription}${alphaDescription}.`,
    evidenceCount: grades.length,
    hadirCount: counts.hadir,
    sakitCount: counts.sakit,
    izinCount: counts.izin,
    alphaCount: counts.alpha,
    pklDays,
    attendancePercentage,
  };
}
