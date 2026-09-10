export function printAttendanceReport(): void {
  const style = document.createElement('style');
  style.textContent = `
    @page { size: A4 portrait; margin: 12mm; }
    @media print {
      html, body { background: #fff !important; }
      body * { visibility: hidden !important; }
      #attendance-report-print, #attendance-report-print * { visibility: visible !important; }
      #attendance-report-print {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
      }
      #attendance-report-print .attendance-report-screen-only { display: none !important; }
      #attendance-report-print .bg-surface-1,
      #attendance-report-print .bg-surface-2 { background: #fff !important; }
      #attendance-report-print table { width: 100% !important; border-collapse: collapse !important; }
      #attendance-report-print th, #attendance-report-print td {
        border-bottom: 1px solid #d1d5db !important;
        color: #000 !important;
        padding: 5px !important;
      }
    }
  `;
  document.head.appendChild(style);
  const cleanup = () => style.remove();
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1500);
}
