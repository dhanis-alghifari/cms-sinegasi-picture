
import { Wallet, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import type { KasSummary } from '../types/dashboard.types';

interface KasSummaryCardProps {
  data?: KasSummary;
}

export function KasSummaryCard({ data }: KasSummaryCardProps) {
  const saldo = data?.saldoTerakhir ?? 0;
  const transaksi = data?.transaksiTerbaru ?? [];
  const transactionContent = (() => {
    if (transaksi.length === 0) {
      return <p className="text-ink-tertiary text-xs italic">Belum ada transaksi</p>;
    }

    return (
      <div className="space-y-2">
        {transaksi.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-1.5 px-2 rounded-md bg-surface-2/60 text-xs border border-hairline/50"
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.tipe === 'masuk' ? (
                <ArrowDownRight size={14} className="text-semantic-success shrink-0" />
              ) : (
                <ArrowUpRight size={14} className="text-semantic-danger shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-ink font-medium truncate">{item.keterangan}</p>
                <p className="text-ink-tertiary text-[10px]">
                  {formatDateShort(item.tanggal)} {item.studentNama ? `• ${item.studentNama}` : ''}
                </p>
              </div>
            </div>
            <span
              className={
                item.tipe === 'masuk'
                  ? 'text-semantic-success font-medium shrink-0 ml-2'
                  : 'text-semantic-danger font-medium shrink-0 ml-2'
              }
            >
              {item.tipe === 'masuk' ? '+' : '-'}{formatCurrency(item.jumlah)}
            </span>
          </div>
        ))}
      </div>
    );
  })();

  return (
    <Card className="bg-surface-1 border-hairline shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-ink text-sm font-medium">Saldo Kas Utama</CardTitle>
        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
          <Wallet size={16} className="text-primary" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-bold text-ink tracking-tight mb-4">
          {formatCurrency(saldo)}
        </div>

        <div className="space-y-2.5">
          <p className="text-ink-subtle text-xs font-medium uppercase tracking-wider">
            Transaksi Terbaru
          </p>

          {transactionContent}
        </div>
      </CardContent>
    </Card>
  );
}
