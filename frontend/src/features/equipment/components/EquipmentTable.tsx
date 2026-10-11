
import { MoreVertical, Edit2, Wrench, QrCode, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { Button } from '@/shared/ui/primitives/button';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { EmptyState } from '@/shared/ui/EmptyState';
import type { Equipment, EquipmentCondition, EquipmentAvailability } from '../types/equipment.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { useCanViewAuditHistory } from '@/features/audit/hooks/useCanViewAuditHistory';
import { formatStatusLabel } from '@/shared/utils/formatLabels';
import { AuthenticatedImage } from '@/shared/ui/AuthenticatedImage';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';

const conditionBadgeMap: Record<EquipmentCondition, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  bagus: { label: 'Bagus', variant: 'success' },
  sedikit_kerusakan: { label: 'Sedikit Rusak', variant: 'warning' },
  rusak: { label: 'Rusak', variant: 'danger' },
  rusak_besar: { label: 'Rusak Besar', variant: 'danger' },
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
      className="h-7 w-7 shrink-0 overflow-hidden rounded border border-hairline bg-surface-2"
      fallback={<span className="text-ink-tertiary text-xs italic">Tanpa Foto</span>}
    />
  );
}

interface EquipmentTableProps {
  equipment: Equipment[];
  onEdit: (equipment: Equipment) => void;
  onUpdateCondition: (equipment: Equipment) => void;
  onOpenRecovery?: (equipment: Equipment) => void;
  canManage?: boolean;
}

export function EquipmentTable({
  equipment,
  onEdit,
  onUpdateCondition,
  onOpenRecovery,
  canManage = true,
}: EquipmentTableProps) {
  const canViewAuditHistory = useCanViewAuditHistory();
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
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">Kode Alat / QR</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Nama Alat & Unit</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Foto Barang</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Kondisi Fisik</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Status Ketersediaan</TableHead>
            {canViewAuditHistory && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>}
            {canManage && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {equipment.map((eq) => {
            const cond = conditionBadgeMap[eq.kondisi] ?? { label: formatStatusLabel(eq.kondisi), variant: 'neutral' as const };
            const avail = availabilityBadgeMap[eq.status] ?? { label: formatStatusLabel(eq.status), variant: 'neutral' as const };

            return (
              <TableRow key={eq.id} className="border-hairline hover:bg-surface-2/40">
                <TableCell className="text-ink-muted text-xs font-mono">
                  <div className="flex items-center gap-1.5 font-bold">
                    <QrCode size={14} className="text-primary shrink-0" />
                    <span>{eq.kode_alat}</span>
                  </div>
                </TableCell>

                <TableCell className="text-ink text-xs font-medium">
                  {eq.nama_alat}
                  {eq.serial_number && (
                    <span className="block text-[10px] text-ink-tertiary font-mono">SN: {eq.serial_number}</span>
                  )}
                </TableCell>

                <TableCell>
                  <EquipmentImage equipmentId={eq.id} alt={eq.nama_alat} cacheScope={cacheScope} />
                </TableCell>

                <TableCell>
                  <StatusBadge label={cond.label} variant={cond.variant} />
                </TableCell>

                <TableCell>
                  <StatusBadge label={avail.label} variant={avail.variant} />
                </TableCell>

                {canViewAuditHistory && <TableCell className="text-right"><AuditHistoryButton tableName="equipment" recordId={eq.id} /></TableCell>}

                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-ink-subtle hover:text-ink">
                            <MoreVertical size={14} />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="bg-surface-3 border-hairline text-ink">
                        <DropdownMenuItem onClick={() => onEdit(eq)} className="text-xs cursor-pointer">
                          <Edit2 size={14} className="mr-2 text-ink-subtle" />
                          Edit Unit Alat
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUpdateCondition(eq)} className="text-xs cursor-pointer">
                          <Wrench size={14} className="mr-2 text-ink-subtle" />
                          Update Kondisi / Status
                        </DropdownMenuItem>
                        {onOpenRecovery && eq.kondisi !== 'bagus' && eq.status !== 'dipinjam' && <DropdownMenuItem onClick={() => onOpenRecovery(eq)} className="text-xs cursor-pointer"><RefreshCw size={14} className="mr-2 text-ink-subtle" />Buka tindak lanjut</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
