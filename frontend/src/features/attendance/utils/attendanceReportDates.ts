import { getLocalDateInputValue } from '@/shared/utils/formatDate';
import type { AttendanceReportPreset } from '../types/attendance.types';

export interface AttendanceReportDateRange {
  dateFrom: string;
  dateTo: string;
}

function formatDateInput(date: Date): string {
  return getLocalDateInputValue(date);
}

function shiftDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getAttendanceReportRange(
  preset: Exclude<AttendanceReportPreset, 'custom'>,
  today = new Date(),
): AttendanceReportDateRange {
  const dateTo = formatDateInput(today);

  if (preset === 'all_time') return { dateFrom: '', dateTo: '' };
  if (preset === 'last_30_days') return { dateFrom: formatDateInput(shiftDays(today, -29)), dateTo };
  if (preset === 'last_90_days') return { dateFrom: formatDateInput(shiftDays(today, -89)), dateTo };

  if (preset === 'semester') {
    const semesterStartMonth = today.getMonth() < 6 ? 0 : 6;
    return {
      dateFrom: formatDateInput(new Date(today.getFullYear(), semesterStartMonth, 1)),
      dateTo,
    };
  }

  return {
    dateFrom: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    dateTo,
  };
}

export function getAttendanceReportPresetLabel(preset: AttendanceReportPreset): string {
  const labels: Record<AttendanceReportPreset, string> = {
    this_month: 'Bulan ini',
    semester: 'Semester berjalan',
    last_30_days: '30 hari terakhir',
    last_90_days: '90 hari terakhir',
    all_time: 'Semua waktu',
    custom: 'Rentang khusus',
  };
  return labels[preset];
}

export function formatAttendanceReportPeriod(dateFrom: string, dateTo: string): string {
  if (!dateFrom && !dateTo) return 'Semua waktu';
  if (!dateFrom || !dateTo) return 'Periode belum lengkap';
  return `${dateFrom} sampai ${dateTo}`;
}
