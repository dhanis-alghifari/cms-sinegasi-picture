import type { StudentOption } from '@/features/students/types/students.types';
import type { AttendanceRecord } from '../types/attendance.types';

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function exportAttendanceReportCsv(
  records: AttendanceRecord[],
  student: StudentOption,
  periodLabel: string,
): void {
  const rows: unknown[][] = [
    ['Rekap Absensi Siswa'],
    ['Nama siswa', student.nama],
    ['NIS', student.nis],
    ['Kelas', student.kelas],
    ['Periode', periodLabel],
    [],
    ['Tanggal', 'NIS', 'Nama siswa', 'Kelas', 'Status', 'Keterangan'],
    ...records.map((record) => [
      record.tanggal,
      record.student_nis,
      record.student_nama,
      record.kelas,
      record.status,
      record.keterangan || '',
    ]),
  ];

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rekap-absensi-${student.nis}-${periodLabel.toLowerCase().replaceAll(' ', '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
