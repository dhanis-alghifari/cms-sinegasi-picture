import type { ReportPrintFormat } from '@/shared/types/report';
import { printReport } from '@/shared/utils/printReport';

export function printAttendanceReport(format: ReportPrintFormat): void {
  printReport({
    rootId: 'attendance-report-print',
    format,
    screenOnlyClass: 'attendance-report-screen-only',
    pageClass: 'attendance-report-page',
  });
}
