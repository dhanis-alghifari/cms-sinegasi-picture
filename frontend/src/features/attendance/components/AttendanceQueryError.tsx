import { RefreshCw } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';

interface AttendanceQueryErrorProps {
  error: unknown;
  title: string;
  onRetry: () => void;
}

export function AttendanceQueryError({ error, title, onRetry }: AttendanceQueryErrorProps) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-semantic-danger/30 bg-semantic-danger/10 p-4 text-sm text-semantic-danger sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-xs">{getErrorMessage(error)}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="self-start border-semantic-danger/30 text-semantic-danger hover:bg-semantic-danger/10 sm:self-auto">
        <RefreshCw size={14} className="mr-1.5" aria-hidden="true" />
        Coba lagi
      </Button>
    </div>
  );
}
