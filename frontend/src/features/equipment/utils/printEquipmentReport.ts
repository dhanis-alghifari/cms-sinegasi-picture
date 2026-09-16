import type { ReportPrintFormat } from '@/shared/types/report';
import { printReport } from '@/shared/utils/printReport';

export function printEquipmentReport(format: ReportPrintFormat): void {
  printReport({
    rootId: 'equipment-report-print',
    format,
    screenOnlyClass: 'equipment-report-screen-only',
    pageClass: 'equipment-report-a4-page',
    slideClass: 'equipment-report-slide',
    a4Orientation: 'landscape',
  });
}
