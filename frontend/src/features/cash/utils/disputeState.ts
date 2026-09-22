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

export function getDisputeStatus(dispute: CashDisputeSummary | undefined): DisputeStatus | undefined {
  return dispute?.status;
}

export function getDisputePresentation(status: DisputeStatus): DisputePresentation {
  if (status === 'pending') return { label: 'Menunggu pemeriksaan guru', variant: 'warning' };
  if (status === 'approved' || status === 'resolved') return { label: 'Sanggahan disetujui', variant: 'success' };
  return { label: 'Sanggahan ditolak', variant: 'danger' };
}

export type DisputeActionOptions = {
  dispute?: CashDisputeSummary;
  quota?: CashDisputeQuota;
  settled?: boolean;
};

export function getDisputeAction({
  dispute,
  quota,
  settled = false,
}: DisputeActionOptions): DisputeAction {
  if (settled) return { canSubmit: false, label: 'Sudah lunas' };
  const status = getDisputeStatus(dispute);
  if (status === 'pending') return { canSubmit: false, label: 'Menunggu pemeriksaan', reason: 'Sanggahan masih diperiksa.' };
  if (status === 'approved' || status === 'resolved') return { canSubmit: false, label: 'Sudah disetujui', reason: 'Catatan ini sudah memiliki keputusan final.' };
  if (quota && quota.remaining <= 0) return { canSubmit: false, label: 'Kuota habis', reason: 'Kuota 2 sanggahan bulan ini sudah habis.' };
  if (status === 'rejected') return { canSubmit: true, label: 'Ajukan ulang', reason: 'Sanggahan sebelumnya ditolak; pengajuan ulang memakai satu kuota bulan ini.' };
  return { canSubmit: true, label: 'Sanggah kas' };
}
