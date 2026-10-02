import { toast } from '@/shared/ui/primitives/toast';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import type { CashInResult } from '../types/cash.types';

export function showCashInSuccessToast(result: CashInResult): void {
  if (result.payment_status === 'unpaid') {
    toast.add({
      type: 'success',
      title: 'Tunggakan tercatat',
      description: `Tunggakan ${formatCurrency(result.amount_outstanding)} berhasil dicatat untuk siswa tersebut.`,
    });
    return;
  }

  if (result.payment_status === 'partial') {
    toast.add({
      type: 'success',
      title: 'Pembayaran tercatat',
      description: `Pembayaran masuk dan tunggakan tersisa ${formatCurrency(result.amount_outstanding)}.`,
    });
    return;
  }

  toast.add({
    type: 'success',
    title: 'Pembayaran tercatat',
    description: 'Pembayaran iuran berhasil dicatat.',
  });
}
