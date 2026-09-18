import type { ReactNode } from 'react';

import type { ReportPrintFormat } from '@/shared/types/report';
import { Button } from '@/shared/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Printer } from 'lucide-react';

interface ReportPreviewDialogProps {
  dialog: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  document: {
    format: ReportPrintFormat;
    title: string;
    description: string;
    screenOnlyClass?: string;
    printOnlyClass?: string;
    pageClass?: string;
    slideClass?: string;
    a4Orientation?: 'portrait' | 'landscape';
  };
  actions: {
    onPrint: () => void;
  };
  children: ReactNode;
}

function scopedClass(className: string | undefined): string {
  return className ? `.report-preview-document .${className}` : '';
}

function getReportAspectRatio(format: ReportPrintFormat, orientation: 'portrait' | 'landscape'): string {
  if (format === 'presentation') return '16 / 9';
  if (orientation === 'landscape') return '297 / 210';
  return '210 / 297';
}

function getReportPreviewWidth(format: ReportPrintFormat, orientation: 'portrait' | 'landscape'): string {
  if (format === 'presentation') return '1200px';
  if (orientation === 'landscape') return '1120px';
  return '840px';
}

export function ReportPreviewDialog({
  dialog,
  document: reportDocument,
  actions,
  children,
}: ReportPreviewDialogProps) {
  const {
    open,
    onOpenChange,
  } = dialog;
  const {
    format,
    title,
    description,
    screenOnlyClass,
    printOnlyClass,
    pageClass,
    slideClass,
    a4Orientation = 'portrait',
  } = reportDocument;

  const screenOnlySelector = scopedClass(screenOnlyClass);
  const printOnlySelector = scopedClass(printOnlyClass);
  const pageSelector = scopedClass(pageClass);
  const slideSelector = scopedClass(slideClass || pageClass);
  const previewSelector = format === 'presentation' ? slideSelector || '.report-preview-document' : pageSelector || '.report-preview-document';
  const screenOnlyRule = screenOnlySelector ? `${screenOnlySelector} { display: none !important; }` : '';
  const printOnlyRule = printOnlySelector ? `${printOnlySelector} { display: block !important; }` : '';
  const ratio = getReportAspectRatio(format, a4Orientation);
  const previewWidth = getReportPreviewWidth(format, a4Orientation);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="report-preview-dialog-content max-w-[min(96vw,1280px)] gap-0 overflow-hidden bg-surface-1 p-0 text-ink">
        <DialogHeader className="shrink-0 border-b border-hairline px-5 py-4 pr-14">
          <DialogTitle className="text-ink">{title}</DialogTitle>
          <DialogDescription className="text-xs text-ink-subtle">{description}</DialogDescription>
        </DialogHeader>

        <div className="report-preview-viewport min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-surface-2 p-3 sm:p-5">
          <div className="report-preview-document space-y-4">
            {children}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-hairline bg-surface-2 px-5 py-3 md:pb-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button type="button" onClick={actions.onPrint} className="bg-primary text-primary-foreground">
            <Printer size={14} />
            Cetak / Simpan PDF
          </Button>
        </DialogFooter>
      </DialogContent>
      <style>{`
        .report-preview-document {
          color: var(--ink);
        }
        .report-preview-dialog-content {
          overflow: hidden !important;
        }
        .report-preview-viewport {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .report-preview-viewport::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
        .report-preview-viewport::-webkit-scrollbar-button,
        .report-preview-viewport::-webkit-scrollbar-thumb,
        .report-preview-viewport::-webkit-scrollbar-track {
          display: none !important;
          background: transparent !important;
        }
        .report-preview-document,
        .report-preview-document * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .report-preview-document *::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        ${screenOnlyRule}
        ${printOnlyRule}
        ${previewSelector} {
          width: min(100%, ${previewWidth}) !important;
          min-height: 0;
          aspect-ratio: ${ratio};
          margin-inline: auto;
          overflow: auto;
          box-sizing: border-box;
          padding: ${format === 'presentation' ? '36px' : '32px'} !important;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          background: #fff !important;
          color: #111827 !important;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        ${previewSelector} * {
          color: #111827 !important;
        }
        .report-preview-document .bg-surface-1,
        .report-preview-document .bg-surface-2,
        .report-preview-document .bg-surface-3 {
          background: #fff !important;
        }
        .report-preview-document [class*="overflow-auto"],
        .report-preview-document [class*="overflow-y-auto"],
        .report-preview-document [class*="overflow-x-auto"],
        .report-preview-document [class*="overflow-scroll"] {
          max-height: none !important;
          max-width: none !important;
          overflow: visible !important;
        }
        .report-preview-document [class*="whitespace-nowrap"],
        .report-preview-document [class*="truncate"] {
          overflow: visible !important;
          white-space: normal !important;
          text-overflow: clip !important;
          overflow-wrap: anywhere !important;
        }
        ${previewSelector} table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        ${previewSelector} th,
        ${previewSelector} td {
          border-bottom: 1px solid #d1d5db !important;
          padding: 5px !important;
        }
        @media (max-width: 640px) {
          ${previewSelector} {
            padding: 20px !important;
          }
        }
      `}</style>
    </Dialog>
  );
}
