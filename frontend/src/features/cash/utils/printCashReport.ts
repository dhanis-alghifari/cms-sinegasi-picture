// src/features/cash/utils/printCashReport.ts
// Browser print helper for the cash report.

export function printCashReport(): void {
    const style = document.createElement("style");
    style.textContent = `
      @page { size: A4 portrait; margin: 12mm; }
      @media print {
        html, body { background: #fff !important; }
        body * { visibility: hidden !important; }
        #cash-report-print, #cash-report-print * { visibility: visible !important; }
        #cash-report-print {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          padding: 0 !important;
          background: #fff !important;
          color: #000 !important;
          font-size: 10pt !important;
        }
        #cash-report-print * { color: #000 !important; }
        #cash-report-print .cash-report-screen-only { display: none !important; }
        #cash-report-print .bg-surface-1,
        #cash-report-print .bg-surface-2,
        #cash-report-print [class~="bg-surface-2/60"] { background: #fff !important; }
        #cash-report-print .cash-report-scroll { max-height: none !important; overflow: visible !important; }
        #cash-report-print .cash-report-page {
          break-after: page;
          page-break-after: always;
          min-height: calc(297mm - 24mm);
          box-sizing: border-box;
        }
        #cash-report-print .cash-report-page:last-child {
          break-after: auto;
          page-break-after: auto;
        }
        #cash-report-print .cash-report-print-only { display: block !important; }
        #cash-report-print table { width: 100% !important; border-collapse: collapse !important; }
        #cash-report-print th, #cash-report-print td {
          border-bottom: 1px solid #d1d5db !important;
          color: #000 !important;
          padding: 5px !important;
        }
        #cash-report-print .cash-report-page-break-inside-avoid { break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);
    const cleanup = () => style.remove();
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
}
