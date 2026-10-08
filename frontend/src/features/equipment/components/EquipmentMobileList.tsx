import { Edit2, MoreVertical, QrCode, Wrench, RefreshCw } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Button } from '@/shared/ui/primitives/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/primitives/dropdown-menu';
import { formatStatusLabel } from '@/shared/utils/formatLabels';
import { AuthenticatedImage } from '@/shared/ui/AuthenticatedImage';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';

import type { Equipment, EquipmentAvailability, EquipmentCondition } from '../types/equipment.types';

interface EquipmentMobileListProps {
  equipment: Equipment[];
  onEdit: (equipment: Equipment) => void;
  onUpdateCondition: (equipment: Equipment) => void;
  onOpenRecovery?: (equipment: Equipment) => void;
  canManage?: boolean;
}

const conditionBadgeMap: Record<EquipmentCondition, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  bagus: { label: 'Bagus', variant: 'success' },
  sedikit_kerusakan: { label: 'Sedikit rusak', variant: 'warning' },
  rusak: { label: 'Rusak', variant: 'danger' },
  rusak_besar: { label: 'Rusak berat', variant: 'danger' },
  sedang_diperbaiki: { label: 'Maintenance', variant: 'warning' },
  hilang: { label: 'Hilang', variant: 'danger' },
};

const availabilityBadgeMap: Record<EquipmentAvailability, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  tersedia: { label: 'Tersedia', variant: 'success' },
  dipinjam: { label: 'Dipinjam', variant: 'warning' },
  maintenance: { label: 'Maintenance', variant: 'neutral' },
};

function EquipmentImage({ equipmentId, alt, cacheScope }: { equipmentId: string; alt: string; cacheScope: string }) {
  return (
    <AuthenticatedImage
      endpoint={`/api/equipment/${encodeURIComponent(equipmentId)}/photo`}
      cacheScope={cacheScope}
      alt={alt}
      className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface-2"
      fallback={<span className="flex h-full w-full items-center justify-center text-ink-tertiary">
      <QrCode size={22} aria-hidden="true" />
      </span>}
    />
  );
}

export function EquipmentMobileList({
  equipment,
  onEdit,
  onUpdateCondition,
  onOpenRecovery,
  canManage = true,
}: EquipmentMobileListProps) {
  const cacheScope = useAuthStore((state) => state.user?.id) ?? '';
  if (equipment.length === 0) {
    return (
      <EmptyState
        title="Tidak ada alat ditemukan"
        description="Belum ada data unit alat sinematografi terdaftar untuk kriteria pencarian ini."
      />
    );
  }

  return (
    <div className="space-y-3" aria-label="Daftar alat versi ponsel">
      {equipment.map((item) => {
        const condition = conditionBadgeMap[item.kondisi] ?? { label: formatStatusLabel(item.kondisi), variant: 'neutral' as const };
        const availability = availabilityBadgeMap[item.status] ?? { label: formatStatusLabel(item.status), variant: 'neutral' as const };

        return (
          <article key={item.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <EquipmentImage equipmentId={item.id} alt={item.nama_alat} cacheScope={cacheScope} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{item.nama_alat}</p>
                    <p className="mt-1 truncate font-mono text-xs text-primary">{item.kode_alat}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <AuditHistoryButton tableName="equipment" recordId={item.id} />
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="text-ink-subtle" aria-label={`Aksi untuk ${item.nama_alat}`} />}>
                          <MoreVertical size={18} aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-hairline bg-surface-3 text-ink">
                          <DropdownMenuItem onClick={() => onEdit(item)} className="min-h-11 cursor-pointer text-sm">
                            <Edit2 size={16} className="mr-2 text-ink-subtle" aria-hidden="true" />
                            Edit data alat
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onUpdateCondition(item)} className="min-h-11 cursor-pointer text-sm">
                            <Wrench size={16} className="mr-2 text-ink-subtle" aria-hidden="true" />
                            Update kondisi/status
                          </DropdownMenuItem>
                          {onOpenRecovery && item.kondisi !== 'bagus' && item.status !== 'dipinjam' && <DropdownMenuItem onClick={() => onOpenRecovery(item)} className="min-h-11 cursor-pointer text-sm"><RefreshCw size={16} className="mr-2 text-ink-subtle" aria-hidden="true" />Buka tindak lanjut</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <p className="mt-1 truncate text-xs text-ink-tertiary">{item.kategori}{item.serial_number ? ` · SN ${item.serial_number}` : ''}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Kondisi</p>
                <div className="mt-1"><StatusBadge label={condition.label} variant={condition.variant} /></div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Ketersediaan</p>
                <div className="mt-1"><StatusBadge label={availability.label} variant={availability.variant} /></div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
