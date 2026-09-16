import { useState } from 'react';
import { CreditCard } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/primitives/table';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { getErrorMessage } from '@/shared/api/errors';
import { equipmentService } from '../api/equipment.service';
import { useRecordEquipmentChargePaymentEventMutation } from '../hooks/useEquipmentRecovery';
import type { EquipmentChargeSettlement, EquipmentRecoveryCase } from '../types/equipment.types';
import { EquipmentChargePaymentDialog, type EquipmentChargePaymentSubmit } from './EquipmentChargePaymentDialog';

interface EquipmentChargesPanelProps {
  charges?: EquipmentChargeSettlement[];
  recoveryCases?: EquipmentRecoveryCase[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  embedded?: boolean;
}

function ChargeStatus({ status }: { status: EquipmentChargeSettlement['status'] }) {
  return <StatusBadge label={status === 'partial' ? 'Sebagian' : 'Belum lunas'} variant="warning" />;
}

export function EquipmentChargesPanel({ charges = [], recoveryCases = [], isLoading, error, onRetry, embedded = false }: EquipmentChargesPanelProps) {
  const mutation = useRecordEquipmentChargePaymentEventMutation();
  const [selectedCharge, setSelectedCharge] = useState<EquipmentChargeSettlement | null>(null);
  const openCharges = charges.filter((charge) => charge.status === 'unpaid' || charge.status === 'partial');
  const containerClass = embedded ? 'pt-4' : 'rounded-xl border border-hairline bg-surface-1 p-4';

  const handleSubmit = async (payload: EquipmentChargePaymentSubmit) => {
    if (!selectedCharge) return;
    const recoveryCase = recoveryCases.find((item) => item.assessment_item_id === selectedCharge.assessment_item_id);
    const paymentEvidence = await Promise.all(payload.paymentEvidence.map((file) => equipmentService.uploadEquipmentChargeEvidence(selectedCharge.id, 'payment', file)));
    const resolutionEvidence = recoveryCase
      ? await Promise.all(payload.resolutionEvidence.map((file) => equipmentService.uploadEquipmentChargeEvidence(selectedCharge.id, recoveryCase.recovery_type, file)))
      : [];
    await mutation.mutateAsync({ settlement_id: selectedCharge.id, payment_amount: payload.paymentAmount, evidence_ids: [...paymentEvidence, ...resolutionEvidence], notes: payload.notes, change_reason: payload.changeReason });
    setSelectedCharge(null);
  };

  const handleOpenCharge = (charge: EquipmentChargeSettlement) => {
    mutation.reset();
    setSelectedCharge(charge);
  };

  const handlePaymentDialogOpenChange = (open: boolean) => {
    if (!open) setSelectedCharge(null);
  };

  if (isLoading) return <div className="flex items-center justify-center py-10"><LoadingSpinner size="sm" label="Memuat tagihan alat..." /></div>;
  if (error) return <QueryErrorState title="Daftar tagihan alat belum dapat dimuat" error={error} onRetry={onRetry} />;

  return (
    <section className={containerClass} aria-label={embedded ? 'Tagihan alat yang belum selesai' : undefined} aria-labelledby={embedded ? undefined : 'equipment-charges-title'}>
      {!embedded && <div className="flex items-start gap-2"><CreditCard size={16} className="mt-0.5 text-semantic-warning" aria-hidden="true" /><div><h2 id="equipment-charges-title" className="text-sm font-semibold text-ink">Tagihan alat yang belum selesai</h2><p className="mt-1 text-xs text-ink-subtle">Selesaikan tagihan sebelum menyetujui peminjaman berikutnya.</p></div></div>}
      {openCharges.length === 0 ? <p className="rounded-lg border border-dashed border-hairline bg-surface-2/60 px-3 py-4 text-xs text-ink-muted">Tidak ada tagihan alat yang belum selesai.</p> : <>
        <div className="hidden overflow-hidden rounded-lg border border-hairline sm:block"><Table><TableHeader><TableRow className="bg-surface-2/70 hover:bg-surface-2/70"><TableHead>Peminjam</TableHead><TableHead>Total tagihan</TableHead><TableHead>Sudah dibayar</TableHead><TableHead>Sisa tagihan</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{openCharges.map((charge) => <TableRow key={charge.id}><TableCell><span className="font-mono text-xs font-semibold text-primary">{charge.student_id.slice(0, 8)}</span></TableCell><TableCell className="text-xs text-ink-subtle">{formatCurrency(charge.amount)}</TableCell><TableCell className="text-xs text-ink-subtle">{formatCurrency(charge.paid_amount)}</TableCell><TableCell className="text-xs font-medium text-ink">{formatCurrency(Math.max(0, charge.amount - charge.paid_amount))}</TableCell><TableCell><ChargeStatus status={charge.status} /></TableCell><TableCell className="text-right"><Button type="button" variant="outline" size="sm" className="min-h-10 text-xs" onClick={() => handleOpenCharge(charge)}>Catat pembayaran</Button></TableCell></TableRow>)}</TableBody></Table></div>
        <div className="space-y-2 sm:hidden">{openCharges.map((charge) => <article key={charge.id} className="rounded-lg border border-hairline bg-surface-2/50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] text-ink-muted">Peminjam</p><p className="font-mono text-xs font-semibold text-primary">{charge.student_id.slice(0, 8)}</p></div><ChargeStatus status={charge.status} /></div><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-ink-muted">Total tagihan</dt><dd className="mt-0.5 text-ink-subtle">{formatCurrency(charge.amount)}</dd></div><div><dt className="text-ink-muted">Sudah dibayar</dt><dd className="mt-0.5 text-ink-subtle">{formatCurrency(charge.paid_amount)}</dd></div><div><dt className="text-ink-muted">Sisa tagihan</dt><dd className="mt-0.5 font-medium text-ink">{formatCurrency(Math.max(0, charge.amount - charge.paid_amount))}</dd></div></dl><Button type="button" variant="outline" size="sm" className="mt-3 min-h-10 text-xs" onClick={() => handleOpenCharge(charge)}>Catat pembayaran</Button></article>)}</div>
      </>}
      <EquipmentChargePaymentDialog key={selectedCharge?.id ?? 'closed'} open={Boolean(selectedCharge)} onOpenChange={handlePaymentDialogOpenChange} charge={selectedCharge} recoveryCase={selectedCharge ? recoveryCases.find((item) => item.assessment_item_id === selectedCharge.assessment_item_id) : undefined} isLoading={mutation.isPending} error={mutation.error} onSubmit={handleSubmit} />
      {mutation.isError && !selectedCharge && <p role="alert" className="mt-3 text-xs text-semantic-danger">{getErrorMessage(mutation.error)}</p>}
    </section>
  );
}
