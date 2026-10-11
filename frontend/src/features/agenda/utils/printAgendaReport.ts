import { printReport } from '@/shared/utils/printReport';
import type { ReportPrintFormat } from '@/shared/types/report';

export function printAgendaReport(format: ReportPrintFormat = 'a4'): void {
  printReport({
    rootId: 'agenda-report-print',
    format,
    a4Orientation: 'landscape',
    screenOnlyClass: 'agenda-report-screen-only',
    pageClass: 'agenda-report-page',
    slideClass: 'agenda-report-slide',
  });
}
