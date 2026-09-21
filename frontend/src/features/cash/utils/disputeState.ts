import type { CashDisputeQuota, CashDisputeSummary, DisputeStatus } from '../types/cash.types';
import type { StatusBadgeVariant } from '@/shared/ui/StatusBadge';

export type DisputeAction = {
  canSubmit: boolean;
  label: string;
  reason?: string;
};

export type DisputePresentation = {
  label: string;
  variant: StatusBadgeVariant;
};

export function getDisputePresentation(status: DisputeStatus): DisputePresentation {
  if (status === 'pending') return { label: 'Menunggu pemeriksaan guru', variant: 'warning' };
  if (status === 'approved' || status === 'resolved') return { label: 'Sanggahan disetujui', variant: 'success' };
  return { label: 'Sanggahan ditolak', variant: 'danger' };
}

export function getDisputeAction(
  dispute: CashDisputeSummary | undefined,
  quota: CashDisputeQuota | undefined,
  settled = false,
  hasActivePendingDispute = false,
  isPendingStatusLoading = false,
): DisputeAction {
  if (settled) return { canSubmit: false, label: 'Sudah lunas' };
  if (isPendingStatusLoading) {
    return {
      canSubmit: false,
      label: 'Memeriksa status',
      reason: 'Status sanggahan sedang diperbarui.',
    };
  }
  const status: DisputeStatus | undefined = dispute?.status;
  if (status === 'pending') return { canSubmit: false, label: 'Menunggu pemeriksaan', reason: 'Sanggahan masih diperiksa.' };
  if (status === 'approved' || status === 'resolved') return { canSubmit: false, label: 'Sudah disetujui', reason: 'Catatan ini sudah memiliki keputusan final.' };
  if (hasActivePendingDispute) {
    return {
      canSubmit: false,
      label: 'Pengajuan sedang diproses',
      reason: 'Selesaikan pemeriksaan sanggahan sebelumnya sebelum mengajukan lagi.',
    };
  }
  if (quota && quota.remaining <= 0) return { canSubmit: false, label: 'Kuota habis', reason: 'Kuota 2 sanggahan bulan ini sudah habis.' };
  if (status === 'rejected') return { canSubmit: true, label: 'Ajukan ulang', reason: 'Sanggahan sebelumnya ditolak; pengajuan ulang memakai satu kuota bulan ini.' };
  return { canSubmit: true, label: 'Sanggah kas' };
}
