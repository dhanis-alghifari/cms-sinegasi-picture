import { Archive, Eye, Pencil } from 'lucide-react';

import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/primitives/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import { formatDateShort } from '@/shared/utils/formatDate';

import type { AgendaActivity } from '../types/agenda.types';

interface AgendaTableProps {
  rows: AgendaActivity[];
  onView: (row: AgendaActivity) => void;
  onEdit: (row: AgendaActivity) => void;
  onArchive: (row: AgendaActivity) => void;
  canWrite: boolean;
  canArchive: boolean;
}

export function AgendaTable({
  rows,
  onView,
  onEdit,
  onArchive,
  canWrite,
  canArchive,
}: AgendaTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Belum ada agenda kegiatan"
        description="Tambahkan laporan kegiatan yang sudah berlangsung."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface-1">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-xs font-semibold text-ink-subtle">Tanggal</TableHead>
            <TableHead className="text-xs font-semibold text-ink-subtle">Kegiatan</TableHead>
            <TableHead className="text-xs font-semibold text-ink-subtle">Pengajar</TableHead>
            <TableHead className="text-xs font-semibold text-ink-subtle">PIC/BPH</TableHead>
            <TableHead className="text-xs font-semibold text-ink-subtle">Foto</TableHead>
            <TableHead className="text-right text-xs font-semibold text-ink-subtle">Aksi</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-hairline hover:bg-surface-2/40">
              <TableCell className="whitespace-nowrap text-xs text-ink-subtle">
                {formatDateShort(`${row.activity_date}T00:00:00`)}
              </TableCell>
              <TableCell className="max-w-64 text-xs">
                <p className="truncate font-semibold text-ink" title={row.activity_name}>
                  {row.activity_name}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] text-ink-tertiary">
                  {row.activity_description}
                </p>
              </TableCell>
              <TableCell className="text-xs text-ink">{row.instructor_name}</TableCell>
              <TableCell className="max-w-52 text-xs text-ink-subtle">
                {row.pic_names.join(', ')}
              </TableCell>
              <TableCell className="text-xs text-ink-subtle">
                {row.photo ? 'Ada' : '—'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Lihat ${row.activity_name}`}
                    onClick={() => onView(row)}
                  >
                    <Eye aria-hidden="true" />
                  </Button>
                  {canWrite && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Edit ${row.activity_name}`}
                      onClick={() => onEdit(row)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  )}
                  {canArchive && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Arsipkan ${row.activity_name}`}
                      onClick={() => onArchive(row)}
                    >
                      <Archive aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
