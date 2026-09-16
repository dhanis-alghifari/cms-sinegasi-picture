import type { ReportPrintFormat } from '@/shared/types/report';
import { printReport } from '@/shared/utils/printReport';

export function printCashReport(format: ReportPrintFormat = 'a4'): void {
  printReport({
    rootId: 'cash-report-print',
    format,
    screenOnlyClass: 'cash-report-screen-only',
    printOnlyClass: 'cash-report-print-only',
    pageClass: 'cash-report-page',
    scrollClass: 'cash-report-scroll',
    fontSize: '10pt',
  });
}
