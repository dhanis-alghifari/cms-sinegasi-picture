import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { Button } from '@/shared/ui/primitives/button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';

import type { CashDisputeQuota, DebtRecord } from '../types/cash.types';
import { getDisputeAction } from '../utils/disputeState';

interface DebtRecordsMobileListProps {
  debts: DebtRecord[];
  isStudent?: boolean;
  onDispute?: (debt: DebtRecord) => void;
  disputeQuota?: CashDisputeQuota;
}

export function DebtRecordsMobileList({ debts, isStudent = false, onDispute, disputeQuota }: DebtRecordsMobileListProps) {
  if (debts.length === 0) {
    return (
      <EmptyState
        title={isStudent ? 'Tidak ada tunggakan' : 'Tidak ada tunggakan siswa'}
        description={isStudent ? 'Semua iuran kas Anda sudah tercatat lunas.' : 'Semua siswa telah melunasi iuran kas wajib.'}
      />
    );
  }

  return (
    <div className="space-y-3" aria-label="Daftar tunggakan siswa versi ponsel">
      {debts.map((debt) => (
        <article key={debt.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{isStudent ? 'Tunggakan kas' : (debt.student_nama || 'Siswa')}</p>
              <p className="mt-1 text-xs text-ink-tertiary">Tanggal tagihan {formatDateShort(debt.created_at)}</p>
            </div>
            <AuditHistoryButton tableName="debt_records" recordId={debt.id} />
          </div>

          <div className="mt-3 flex items-end justify-between gap-3 rounded-lg bg-surface-2 p-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Status</p>
              <div className="mt-1">
                <StatusBadge
                  label={debt.status === 'paid' ? 'Lunas' : 'Belum lunas'}
                  variant={debt.status === 'paid' ? 'success' : 'danger'}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Total tunggakan</p>
              <p className="mt-1 text-sm font-semibold text-semantic-danger">{formatCurrency(debt.amount)}</p>
            </div>
          </div>

          {isStudent && onDispute && (() => { const action = getDisputeAction(debt.dispute, disputeQuota, debt.status === 'paid'); return (
            <div className="mt-3 flex justify-end border-t border-hairline pt-3">
              <Button type="button" size="sm" disabled={!action.canSubmit} title={action.reason} className="min-h-11 w-full border-primary bg-primary px-3 text-xs text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary/30 sm:w-auto" onClick={() => onDispute(debt)}>{action.label}</Button>
            </div>
          ); })()}
        </article>
      ))}
    </div>
  );
}
