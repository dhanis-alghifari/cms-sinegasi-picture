import { AlertTriangle, CheckCircle2, RefreshCw, Wrench } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { DataTableSkeleton } from '@/shared/ui/LoadingSkeletons';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import type { Equipment, EquipmentRecoveryCase } from '../types/equipment.types';
import { getEquipmentFollowUpTargets } from './equipmentAttention.helpers';

interface EquipmentRecoveryPanelProps {
  data: {
    equipment: Equipment[];
    cases: EquipmentRecoveryCase[];
    isLoading?: boolean;
    error?: unknown;
  };
  view?: {
    embedded?: boolean;
    mode?: 'active' | 'history';
  };
  actions: {
    onRetry?: () => void;
    onOpenCreate: (equipment: Equipment) => void;
    onOpenRepair: (recoveryCase: EquipmentRecoveryCase, equipment?: Equipment) => void;
    onOpenReplacement: (recoveryCase: EquipmentRecoveryCase, equipment?: Equipment) => void;
  };
  permissions?: {
    canManage?: boolean;
  };
}

const caseStatus: Record<EquipmentRecoveryCase['status'], { label: string; variant: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  open: { label: 'Terbuka', variant: 'warning' },
  in_progress: { label: 'Sedang dikerjakan', variant: 'warning' },
  awaiting_verification: { label: 'Menunggu verifikasi', variant: 'warning' },
  completed: { label: 'Selesai', variant: 'success' },
  unrepairable: { label: 'Tidak dapat diperbaiki', variant: 'danger' },
  cancelled: { label: 'Dibatalkan', variant: 'neutral' },
};

const conditionLabels: Record<string, string> = {
  bagus: 'Bagus',
  sedikit_kerusakan: 'Kerusakan ringan',
  rusak: 'Rusak',
  rusak_besar: 'Rusak berat',
  sedang_diperbaiki: 'Sedang diperbaiki',
  hilang: 'Hilang',
};

function conditionLabel(condition: string) {
  return conditionLabels[condition] ?? condition.replaceAll('_', ' ');
}

function RecoveryAction({
  recoveryCase,
  equipment,
  onOpenRepair,
  onOpenReplacement,
}: {
  recoveryCase: EquipmentRecoveryCase;
  equipment?: Equipment;
  onOpenRepair: (recoveryCase: EquipmentRecoveryCase, equipment?: Equipment) => void;
  onOpenReplacement: (recoveryCase: EquipmentRecoveryCase, equipment?: Equipment) => void;
}) {
  if (recoveryCase.recovery_type === 'repair') {
    return (
      <Button type="button" size="sm" onClick={() => onOpenRepair(recoveryCase, equipment)} className="min-h-10 text-xs">
        <CheckCircle2 size={14} aria-hidden="true" />
        Selesaikan
      </Button>
    );
  }

  return (
    <Button type="button" size="sm" onClick={() => onOpenReplacement(recoveryCase, equipment)} className="min-h-10 text-xs">
      <RefreshCw size={14} aria-hidden="true" />
      Daftarkan pengganti
    </Button>
  );
}

export function EquipmentRecoveryPanel({
  data,
  view,
  actions,
  permissions,
}: EquipmentRecoveryPanelProps) {
  const { equipment, cases, isLoading, error } = data;
  const { embedded = false, mode = 'active' } = view ?? {};
  const {
    onRetry,
    onOpenCreate,
    onOpenRepair,
    onOpenReplacement,
  } = actions;
  const { canManage = true } = permissions ?? {};
  const targetById = new Map(equipment.map((item) => [item.id, item]));
  const isHistory = mode === 'history';
  const followUpTargets = isHistory ? [] : getEquipmentFollowUpTargets(equipment, cases);
  const containerClass = embedded ? 'pt-4' : 'rounded-xl border border-hairline bg-surface-1 p-4';
  const sectionLabel = isHistory ? 'Riwayat penyelesaian alat' : 'Tindak lanjut alat';
  const showActions = canManage && !isHistory;

  const loadingLabel = isHistory ? 'Memuat riwayat tindak lanjut alat...' : 'Memuat tindak lanjut alat...';
  if (isLoading) return <DataTableSkeleton columns={5} rows={4} label={loadingLabel} className={embedded ? 'pt-4' : undefined} />;
  if (error) return <QueryErrorState title={isHistory ? 'Riwayat tindak lanjut alat belum dapat dimuat' : 'Tindak lanjut alat belum dapat dimuat'} error={error} onRetry={onRetry} />;

  return (
    <section className={containerClass} aria-label={embedded ? sectionLabel : undefined} aria-labelledby={embedded ? undefined : 'equipment-recovery-title'}>
      {!embedded && (
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 text-semantic-warning" aria-hidden="true" />
          <div>
            <h2 id="equipment-recovery-title" className="text-sm font-semibold text-ink">{sectionLabel}</h2>
            <p className="mt-1 text-xs text-ink-subtle">{isHistory ? 'Lihat catatan servis dan penggantian yang sudah diselesaikan.' : 'Selesaikan servis atau daftarkan unit pengganti agar alat kembali tercatat dengan benar.'}</p>
          </div>
        </div>
      )}

      {cases.length === 0 && followUpTargets.length === 0 && (
        <p className="rounded-lg border border-dashed border-hairline bg-surface-2/60 px-3 py-4 text-xs text-ink-muted">
          {isHistory ? 'Belum ada riwayat penyelesaian alat.' : 'Tidak ada alat yang perlu ditindaklanjuti saat ini.'}
        </p>
      )}
      {(cases.length > 0 || followUpTargets.length > 0) && (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-hairline sm:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-2/70 hover:bg-surface-2/70">
                  <TableHead>Alat</TableHead>
                  <TableHead>Kondisi</TableHead>
                  <TableHead>Tindak lanjut</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Biaya aktual</TableHead>
                  {isHistory && <TableHead>Selesai</TableHead>}
                  {showActions && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((item) => {
                  const target = targetById.get(item.equipment_id);
                  const status = caseStatus[item.status] ?? caseStatus.open;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="min-w-36">
                          <p className="font-mono text-xs font-semibold text-primary">{target?.kode_alat || item.equipment_id.slice(0, 8)}</p>
                          <p className="mt-0.5 text-xs text-ink">{target?.nama_alat || 'Alat'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-ink-subtle">{conditionLabel(item.reported_condition)}</TableCell>
                      <TableCell className="text-xs text-ink-subtle">{item.recovery_type === 'repair' ? 'Perbaikan / servis' : 'Penggantian unit'}</TableCell>
                      <TableCell><StatusBadge label={status.label} variant={status.variant} /></TableCell>
                      <TableCell className="text-xs text-ink-subtle">{item.actual_cost !== undefined ? formatCurrency(item.actual_cost) : '-'}</TableCell>
                      {isHistory && <TableCell className="text-xs text-ink-subtle">{item.completed_at ? formatDateShort(item.completed_at) : '-'}</TableCell>}
                      {showActions && (
                        <TableCell className="text-right">
                          <RecoveryAction recoveryCase={item} equipment={target} onOpenRepair={onOpenRepair} onOpenReplacement={onOpenReplacement} />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {followUpTargets.map((item) => (
                  <TableRow key={`target-${item.id}`}>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold text-primary">{item.kode_alat}</p>
                      <p className="mt-0.5 text-xs text-ink">{item.nama_alat}</p>
                    </TableCell>
                    <TableCell className="text-xs text-ink-subtle">{conditionLabel(item.kondisi)}</TableCell>
                    <TableCell className="text-xs text-ink-subtle">Belum dibuat</TableCell>
                    <TableCell><StatusBadge label="Perlu dibuka" variant="warning" /></TableCell>
                    <TableCell className="text-xs text-ink-subtle">-</TableCell>
                    {showActions && <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => onOpenCreate(item)} className="min-h-10 text-xs">
                        <Wrench size={14} aria-hidden="true" />
                        Buka tindak lanjut
                      </Button>
                    </TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 sm:hidden">
            {cases.map((item) => {
              const target = targetById.get(item.equipment_id);
              const status = caseStatus[item.status] ?? caseStatus.open;
              return (
                <article key={item.id} className="rounded-lg border border-hairline bg-surface-2/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-primary">{target?.kode_alat || item.equipment_id.slice(0, 8)}</p>
                      <p className="mt-0.5 truncate text-xs text-ink">{target?.nama_alat || 'Alat'}</p>
                    </div>
                    <StatusBadge label={status.label} variant={status.variant} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-ink-muted">Kondisi</dt><dd className="mt-0.5 text-ink-subtle">{conditionLabel(item.reported_condition)}</dd></div>
                    <div><dt className="text-ink-muted">Tindak lanjut</dt><dd className="mt-0.5 text-ink-subtle">{item.recovery_type === 'repair' ? 'Perbaikan / servis' : 'Penggantian unit'}</dd></div>
                    <div><dt className="text-ink-muted">Biaya aktual</dt><dd className="mt-0.5 text-ink-subtle">{item.actual_cost !== undefined ? formatCurrency(item.actual_cost) : '-'}</dd></div>
                    {isHistory && <div><dt className="text-ink-muted">Selesai</dt><dd className="mt-0.5 text-ink-subtle">{item.completed_at ? formatDateShort(item.completed_at) : '-'}</dd></div>}
                  </dl>
                  {showActions && <div className="mt-3"><RecoveryAction recoveryCase={item} equipment={target} onOpenRepair={onOpenRepair} onOpenReplacement={onOpenReplacement} /></div>}
                </article>
              );
            })}
            {followUpTargets.map((item) => (
              <article key={`target-${item.id}`} className="rounded-lg border border-hairline bg-surface-2/50 p-3">
                <p className="font-mono text-xs font-semibold text-primary">{item.kode_alat}</p>
                <p className="mt-0.5 text-xs text-ink">{item.nama_alat}</p>
                <p className="mt-2 text-xs text-ink-subtle">Kondisi: {conditionLabel(item.kondisi)}. Tindak lanjut belum dibuat.</p>
                {showActions && <Button type="button" variant="outline" size="sm" onClick={() => onOpenCreate(item)} className="mt-3 min-h-10 text-xs">
                  <Wrench size={14} aria-hidden="true" />
                  Buka tindak lanjut
                </Button>}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
