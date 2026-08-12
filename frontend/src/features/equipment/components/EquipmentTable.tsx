// src/features/equipment/components/EquipmentTable.tsx

import { useState } from 'react';
import { MoreVertical, Edit2, Wrench, QrCode } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/feedback/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import type { Equipment, EquipmentCondition, EquipmentAvailability } from '../types/equipment.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditTable';
import { formatStatusLabel } from '@/shared/utils/formatLabels';

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

function EquipmentImage({ src, alt }: { src?: string; alt: string }) {
  const [isError, setIsError] = useState(false);

  if (src && !isError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setIsError(true)}
        className="w-7 h-7 rounded object-cover border border-hairline bg-surface-2"
      />
    );
  }

  return <span className="text-ink-tertiary text-xs italic">Tanpa Foto</span>;
}

interface EquipmentTableProps {
  equipment: Equipment[];
  onEdit: (equipment: Equipment) => void;
  onUpdateCondition: (equipment: Equipment) => void;
  canManage?: boolean;
}

export function EquipmentTable({
  equipment,
  onEdit,
  onUpdateCondition,
  canManage = true,
}: EquipmentTableProps) {
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
            <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
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
                  <EquipmentImage src={eq.foto_urls?.[0] ?? eq.foto_url} alt={eq.nama_alat} />
                </TableCell>

                <TableCell>
                  <StatusBadge label={cond.label} variant={cond.variant} />
                </TableCell>

                <TableCell>
                  <StatusBadge label={avail.label} variant={avail.variant} />
                </TableCell>

                <TableCell className="text-right"><AuditHistoryButton tableName="equipment" recordId={eq.id} /></TableCell>

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
