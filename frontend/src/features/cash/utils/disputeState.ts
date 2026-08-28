import type { CashDisputeQuota, CashDisputeSummary, DisputeStatus } from '../types/cash.types';

export type DisputeAction = {
  canSubmit: boolean;
  label: string;
  reason?: string;
};

export function getDisputeAction(
  dispute: CashDisputeSummary | undefined,
  quota: CashDisputeQuota | undefined,
  settled = false,
): DisputeAction {
  if (settled) return { canSubmit: false, label: 'Sudah lunas' };
  const status: DisputeStatus | undefined = dispute?.status;
  if (status === 'pending') return { canSubmit: false, label: 'Menunggu pemeriksaan', reason: 'Sanggahan masih diperiksa.' };
  if (status === 'approved' || status === 'resolved') return { canSubmit: false, label: 'Sudah disetujui', reason: 'Catatan ini sudah memiliki keputusan final.' };
  if (quota && quota.remaining <= 0) return { canSubmit: false, label: 'Kuota habis', reason: 'Kuota 2 sanggahan bulan ini sudah habis.' };
  if (status === 'rejected') return { canSubmit: true, label: 'Ajukan ulang', reason: 'Sanggahan sebelumnya ditolak; pengajuan ulang memakai satu kuota bulan ini.' };
  return { canSubmit: true, label: 'Sanggah kas' };
}
