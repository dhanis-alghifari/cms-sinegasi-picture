import { EmptyState } from '@/shared/ui/EmptyState';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';

import type { CashReportDebtStudent } from '../types/cash.types';

interface CashReportDebtMobileListProps {
  debts: CashReportDebtStudent[];
}

export function CashReportDebtMobileList({ debts }: CashReportDebtMobileListProps) {
  if (debts.length === 0) {
    return (
      <EmptyState
        title="Tidak ada siswa menunggak"
        description="Tidak ada tunggakan yang tercatat pada periode laporan ini."
      />
    );
  }

  return (
    <div className="space-y-3 px-3 pb-3" aria-label="Daftar siswa menunggak versi ponsel">
      {debts.map((debt) => (
        <article key={debt.student_id} className="rounded-lg border border-hairline bg-surface-2/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-ink">{debt.student_nama}</h3>
              <p className="mt-1 truncate text-xs text-ink-subtle">
                {debt.kelas || 'Kelas belum tersedia'}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Total tunggakan</p>
              <p className="mt-1 text-sm font-semibold text-semantic-danger">
                {formatCurrency(debt.total_debt)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-tertiary">
            <span>{debt.debt_record_count} catatan tunggakan</span>
            {debt.oldest_debt_date && (
              <span>Sejak {formatDateShort(debt.oldest_debt_date)}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
