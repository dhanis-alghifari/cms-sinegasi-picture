import type { ReportPrintFormat } from '@/shared/types/report';
import { UI_CONSTANTS } from '@/shared/constants/ui';

interface PrintReportOptions {
  rootId: string;
  format: ReportPrintFormat;
  screenOnlyClass: string;
  printOnlyClass?: string;
  pageClass?: string;
  slideClass?: string;
  a4Orientation?: 'portrait' | 'landscape';
  fontSize?: string;
  scrollClass?: string;
}

function classSelector(rootSelector: string, className: string | undefined): string {
  return className ? `${rootSelector} .${className}` : '';
}

export function printReport({
  rootId,
  format,
  screenOnlyClass,
  printOnlyClass,
  pageClass,
  slideClass,
  a4Orientation = 'portrait',
  fontSize,
  scrollClass,
}: PrintReportOptions): void {
  const rootSelector = `#${rootId}`;
  const pageSelector = classSelector(rootSelector, pageClass);
  const slideSelector = classSelector(rootSelector, slideClass || pageClass);
  const screenOnlySelector = classSelector(rootSelector, screenOnlyClass);
  const printOnlySelector = classSelector(rootSelector, printOnlyClass);
  const presentationWidth = '13.333in';
  const presentationHeight = '7.5in';
  const pageSize = a4Orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  const a4Margin = a4Orientation === 'landscape' ? '10mm' : '12mm';
  const a4MinHeight = a4Orientation === 'landscape' ? 'calc(210mm - 20mm)' : 'calc(297mm - 24mm)';
  const rootFontSize = fontSize ? `font-size: ${fontSize} !important;` : '';
  const printOnlyRule = printOnlySelector ? `${printOnlySelector} { display: block !important; }` : '';
  const scrollRule = scrollClass
    ? `${classSelector(rootSelector, scrollClass)} { max-height: none !important; overflow: visible !important; }`
    : '';
  const pageRule = format === 'a4' && pageSelector
    ? `
      ${pageSelector} {
        break-after: page;
        page-break-after: always;
        min-height: ${a4MinHeight};
        box-sizing: border-box;
      }
      ${pageSelector}:last-of-type {
        break-after: auto;
        page-break-after: auto;
      }
    `
    : '';
  const slideRule = format === 'presentation'
    ? `
      ${slideSelector || rootSelector} {
        width: ${presentationWidth} !important;
        min-height: ${presentationHeight} !important;
        height: auto !important;
        box-sizing: border-box;
        break-after: page;
        page-break-after: always;
        padding: 12mm !important;
      }
      ${slideSelector || rootSelector}:last-of-type {
        break-after: auto;
        page-break-after: auto;
      }
    `
    : '';
  const style = document.createElement('style');
  style.textContent = `
    @page { size: ${format === 'presentation' ? '13.333in 7.5in' : pageSize}; margin: ${format === 'presentation' ? '0' : a4Margin}; }
    @media print {
      html, body { background: #fff !important; }
      body * { visibility: hidden !important; }
      ${rootSelector}, ${rootSelector} * { visibility: visible !important; }
      body:has(${rootSelector}) [data-slot="dialog-content"],
      body:has(${rootSelector}) [data-slot="dialog-content"] > [class*="overflow-auto"],
      body:has(${rootSelector}) [data-slot="dialog-content"] > [class*="overflow-y-auto"],
      body:has(${rootSelector}) [data-slot="dialog-content"] > [class*="overflow-x-auto"] {
        max-height: none !important;
        max-width: none !important;
        overflow: visible !important;
      }
      ${rootSelector} {
        position: absolute !important;
        inset: 0 auto auto 0 !important;
        width: ${format === 'presentation' ? presentationWidth : '100%'} !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        ${rootFontSize}
      }
      ${rootSelector} * { color: #000 !important; }
      ${screenOnlySelector} { display: none !important; }
      ${printOnlyRule}
      ${rootSelector} .bg-surface-1,
      ${rootSelector} .bg-surface-2,
      ${rootSelector} .bg-surface-3,
      ${rootSelector} [class~="bg-surface-2/60"] { background: #fff !important; }
      ${rootSelector} [class*="overflow-auto"],
      ${rootSelector} [class*="overflow-y-auto"],
      ${rootSelector} [class*="overflow-x-auto"],
      ${rootSelector} [class*="overflow-scroll"] {
        max-height: none !important;
        max-width: none !important;
        overflow: visible !important;
      }
      ${rootSelector} [class*="whitespace-nowrap"],
      ${rootSelector} [class*="truncate"] {
        overflow: visible !important;
        white-space: normal !important;
        text-overflow: clip !important;
        overflow-wrap: anywhere !important;
      }
      ${scrollRule}
      ${pageRule}
      ${slideRule}
      ${rootSelector} table {
        width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
      }
      ${rootSelector} th, ${rootSelector} td {
        border-bottom: 1px solid #d1d5db !important;
        color: #000 !important;
        padding: 5px !important;
      }
      ${rootSelector} img { break-inside: avoid; }
      ${rootSelector}, ${rootSelector} * {
        scrollbar-width: none !important;
      }
      ${rootSelector}::-webkit-scrollbar,
      ${rootSelector} *::-webkit-scrollbar {
        display: none !important;
      }
      ${rootSelector} .equipment-report-break-inside-avoid,
      ${rootSelector} .cash-report-page-break-inside-avoid { break-inside: avoid; }
    }
  `;
  document.head.appendChild(style);
  const cleanup = () => {
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, UI_CONSTANTS.PRINT_CLEANUP_MS);
}
