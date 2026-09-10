import { Edit2, Power } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/primitives/button';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import type { ClassRecord } from '../types/classes.types';

interface ClassMobileListProps {
  classes: ClassRecord[];
  onEdit: (item: ClassRecord) => void;
  onToggleStatus: (item: ClassRecord) => void;
  canManage?: boolean;
}

export function ClassMobileList({ classes, onEdit, onToggleStatus, canManage = false }: ClassMobileListProps) {
  if (classes.length === 0) return <EmptyState title="Tidak ada kelas yang ditemukan" description="Coba ubah pencarian atau tingkat kelas." />;

  return (
    <div className="space-y-3" aria-label="Daftar kelas versi ponsel">
      {classes.map((item) => (
        <article key={item.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{item.nama_kelas}</p>
              <p className="mt-1 text-xs text-ink-tertiary">Tingkat {item.tingkat}</p>
            </div>
            <AuditHistoryButton tableName="classes" recordId={item.id} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3">
            <StatusBadge label={item.is_active ? 'Aktif' : 'Nonaktif'} variant={item.is_active ? 'success' : 'neutral'} />
            {canManage && <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label={`Edit ${item.nama_kelas}`}><Edit2 size={17} aria-hidden="true" /></Button>
              <Button variant="ghost" size="icon" onClick={() => onToggleStatus(item)} aria-label={`${item.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${item.nama_kelas}`} className={item.is_active ? 'text-semantic-danger' : 'text-semantic-success'}><Power size={17} aria-hidden="true" /></Button>
            </div>}
          </div>
        </article>
      ))}
    </div>
  );
}
