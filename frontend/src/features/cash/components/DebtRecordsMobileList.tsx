import { AuditHistoryButton } from '@/features/audit/components/AuditTable';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/feedback/StatusBadge';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';

import type { DebtRecord } from '../types/cash.types';

interface DebtRecordsMobileListProps {
  debts: DebtRecord[];
}

export function DebtRecordsMobileList({ debts }: DebtRecordsMobileListProps) {
  if (debts.length === 0) {
    return (
      <EmptyState
        title="Tidak ada tunggakan siswa"
        description="Semua siswa telah melunasi iuran kas wajib."
      />
    );
  }

  return (
    <div className="space-y-3" aria-label="Daftar tunggakan siswa versi ponsel">
      {debts.map((debt) => (
        <article key={debt.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{debt.student_nama || 'Siswa'}</p>
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
        </article>
      ))}
    </div>
  );
}
