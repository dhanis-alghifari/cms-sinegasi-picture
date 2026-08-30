// src/features/cash/components/CashBalanceCards.tsx
// Summary cards for cash balance, total inbound, total outbound, and total student debt

import { Wallet, ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/primitives/card';
import { CashSectionError, CashSectionSkeleton } from './CashSectionState';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import type { CashSummary } from '../types/cash.types';

interface CashBalanceCardsProps {
  summary?: CashSummary;
  isStudent?: boolean;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

export function CashBalanceCards({
  summary,
  isStudent = false,
  isLoading = false,
  error,
  onRetry,
}: CashBalanceCardsProps) {
  if (isLoading) {
    return <CashSectionSkeleton rows={1} />;
  }

  if (error) {
    return <CashSectionError error={error} onRetry={onRetry ?? (() => undefined)} title="Saldo kas belum tersedia" />;
  }

  const saldo = summary?.saldoUtama ?? 0;
  const pemasukan = summary?.totalPemasukan ?? 0;
  const pengeluaran = summary?.totalPengeluaran ?? 0;
  const tunggakan = summary?.totalTunggakanSiswa ?? 0;

  if (isStudent) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-ink-subtle text-xs font-medium">Total pembayaran saya</span>
              <div className="flex h-7 w-7 items-center justify-center rounded bg-semantic-success/15">
                <ArrowDownRight size={14} className="text-semantic-success" />
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight text-semantic-success">{formatCurrency(pemasukan)}</div>
          </CardContent>
        </Card>
        <Card className="bg-surface-1 border-hairline shadow-none">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-ink-subtle text-xs font-medium">Tunggakan saya</span>
              <div className="flex h-7 w-7 items-center justify-center rounded bg-semantic-warning/15">
                <AlertCircle size={14} className="text-semantic-warning" />
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight text-semantic-warning">{formatCurrency(tunggakan)}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="border-hairline bg-surface-1 shadow-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink-subtle">Saldo saat ini</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {formatCurrency(saldo)}
            </p>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">
            <Wallet className="size-5 text-primary" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-hairline pt-4 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="size-4 shrink-0 text-semantic-success" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-ink-tertiary">Pemasukan</p>
              <p className="truncate text-sm font-semibold text-semantic-success">+{formatCurrency(pemasukan)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpRight className="size-4 shrink-0 text-semantic-danger" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-ink-tertiary">Pengeluaran</p>
              <p className="truncate text-sm font-semibold text-semantic-danger">-{formatCurrency(pengeluaran)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-semantic-warning" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-ink-tertiary">Tunggakan</p>
              <p className="truncate text-sm font-semibold text-semantic-warning">{formatCurrency(tunggakan)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
