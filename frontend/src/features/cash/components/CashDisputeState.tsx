import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { cn } from '@/shared/utils/cn';

import type { CashDisputeQuota, CashDisputeSummary } from '../types/cash.types';
import { getDisputeAction, getDisputePresentation } from '../utils/disputeState';

type CashDisputeStatusProps = {
  dispute?: CashDisputeSummary;
};

type CashDisputeActionProps = CashDisputeStatusProps & {
  quota?: CashDisputeQuota;
  settled?: boolean;
  fullWidth?: boolean;
  hasActivePendingDispute?: boolean;
  isPendingStatusLoading?: boolean;
  onSubmit: () => void;
};

export function CashDisputeStatus({ dispute }: CashDisputeStatusProps) {
  if (!dispute) return <span className="text-xs text-ink-tertiary">-</span>;

  const presentation = getDisputePresentation(dispute.status);
  return <StatusBadge label={presentation.label} variant={presentation.variant} />;
}

export function CashDisputeAction({
  dispute,
  quota,
  settled = false,
  fullWidth = false,
  hasActivePendingDispute = false,
  isPendingStatusLoading = false,
  onSubmit,
}: CashDisputeActionProps) {
  const action = getDisputeAction(
    dispute,
    quota,
    settled,
    hasActivePendingDispute,
    isPendingStatusLoading,
  );

  if (!action.canSubmit) {
    const isPending = dispute?.status === 'pending' || hasActivePendingDispute || isPendingStatusLoading;
    const isApproved = dispute?.status === 'approved' || dispute?.status === 'resolved';
    let Icon = AlertCircle;
    if (isPending) Icon = Clock3;
    if (isApproved) Icon = CheckCircle2;

    return (
      <span
        role="status"
        title={action.reason}
        className={cn(
          'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium',
          isPending && 'bg-semantic-warning/10 text-semantic-warning',
          isApproved && 'bg-semantic-success/10 text-semantic-success',
          !isPending && !isApproved && 'bg-surface-2 text-ink-subtle',
          fullWidth && 'w-full sm:w-auto',
        )}
      >
        <Icon size={13} aria-hidden="true" />
        {action.label}
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      title={action.reason}
      onClick={onSubmit}
      className={cn(
        'min-h-9 border-primary bg-primary px-3 text-xs text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary/30',
        fullWidth && 'min-h-11 w-full sm:w-auto',
      )}
    >
      <AlertCircle size={13} aria-hidden="true" />
      {action.label}
    </Button>
  );
}
