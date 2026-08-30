import { EmptyState } from '@/shared/ui/EmptyState';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatEnumLabel, formatPaymentMethodLabel } from '@/shared/utils/formatLabels';

import type { CashReportDetail } from '../types/cash.types';

interface CashReportDetailMobileListProps {
  rows: CashReportDetail[];
  kind: 'income' | 'expense';
}

export function CashReportDetailMobileList({ rows, kind }: CashReportDetailMobileListProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={kind === 'income' ? 'Belum ada pemasukan' : 'Belum ada pengeluaran'}
        description="Tidak ada transaksi pada periode laporan yang dipilih."
      />
    );
  }

  return (
    <div className="space-y-3" aria-label={`Rincian ${kind === 'income' ? 'pemasukan' : 'pengeluaran'} versi ponsel`}>
      {rows.map((row) => {
        const personOrContext = row.student_name || row.note || 'Transaksi umum';
        const typeLabel = row.label || (row.type ? formatEnumLabel(row.type) : 'Transaksi kas');
        const paymentMethod = formatPaymentMethodLabel(row.payment_method_code, row.payment_method_label);

        return (
          <article key={row.id} className="rounded-lg border border-hairline bg-surface-2/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-ink-tertiary">{formatDateShort(row.date)}</p>
                <h3 className="mt-1 truncate text-sm font-semibold text-ink">{typeLabel}</h3>
              </div>
              <p className={kind === 'income' ? 'shrink-0 text-sm font-semibold text-semantic-success' : 'shrink-0 text-sm font-semibold text-semantic-danger'}>
                {kind === 'income' ? '+' : '-'}{formatCurrency(row.amount)}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-subtle">
              <span className="rounded-full bg-surface-3 px-2 py-1">{paymentMethod}</span>
              <span className="min-w-0 truncate">{personOrContext}</span>
            </div>

            {row.student_name && row.note && (
              <p className="mt-2 line-clamp-2 text-xs text-ink-tertiary">{row.note}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
