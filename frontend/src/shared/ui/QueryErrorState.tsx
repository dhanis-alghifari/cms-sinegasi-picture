import { AlertCircle, RefreshCw } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';

interface QueryErrorStateProps {
  title: string;
  error?: unknown;
  onRetry?: () => void;
}

export function QueryErrorState({ title, error, onRetry }: QueryErrorStateProps) {
  return (
    <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 px-4 py-5 text-center">
      <AlertCircle className="mx-auto mb-2 size-5 text-semantic-danger" aria-hidden="true" />
      <h2 className="text-sm font-semibold text-semantic-danger">{title}</h2>
      <p className="mt-1 text-sm text-ink-subtle">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-4 border-semantic-danger/40 text-semantic-danger hover:bg-semantic-danger/10">
          <RefreshCw className="mr-1.5 size-4" aria-hidden="true" />
          Coba lagi
        </Button>
      )}
    </div>
  );
}
