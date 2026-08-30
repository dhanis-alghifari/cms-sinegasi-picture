import { AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { getErrorMessage } from '@/shared/api/errors';

interface CashSectionSkeletonProps {
  rows?: number;
}

export function CashSectionSkeleton({ rows = 3 }: CashSectionSkeletonProps) {
  return (
    <div className="space-y-3" aria-label="Memuat data kas" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="motion-safe:animate-pulse rounded-xl border border-hairline bg-surface-1 p-4"
        >
          <div className="h-4 w-32 rounded bg-surface-2" />
          <div className="mt-3 h-3 w-2/3 rounded bg-surface-2" />
          <div className="mt-4 h-10 rounded-lg bg-surface-2" />
        </div>
      ))}
    </div>
  );
}

interface CashSectionErrorProps {
  error?: unknown;
  onRetry: () => void;
  title?: string;
}

export function CashSectionError({
  error,
  onRetry,
  title = 'Data kas belum dapat dimuat',
}: CashSectionErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-semantic-danger/30 bg-semantic-danger/5 px-4 py-10 text-center">
      <AlertCircle className="size-8 text-semantic-danger" aria-hidden="true" />
      <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-subtle">
        {getErrorMessage(error) || 'Periksa koneksi lalu coba lagi.'}
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        className="mt-4 min-h-11 gap-2 text-sm text-ink"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        Coba lagi
      </Button>
    </div>
  );
}
