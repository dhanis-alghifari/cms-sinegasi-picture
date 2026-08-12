import { ClipboardList } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatEnumLabel } from '@/shared/utils/formatLabels';

import { ASSIGNMENT_CATEGORY_LABELS, type Assignment } from '../types/grades.types';

interface AssignmentMobileListProps {
  assignments: Assignment[];
}

export function AssignmentMobileList({ assignments }: AssignmentMobileListProps) {
  if (assignments.length === 0) {
    return <EmptyState icon={ClipboardList} title="Belum ada tugas penilaian" description="Buat tugas atau kegiatan baru agar dapat digunakan untuk penilaian siswa." />;
  }

  return (
    <div className="space-y-3" aria-label="Daftar tugas versi ponsel">
      {assignments.map((assignment) => (
        <article key={assignment.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{assignment.title}</p>
              <p className="mt-1 text-xs text-ink-tertiary">{formatDateShort(assignment.date)} · {assignment.kelas || 'Semua kelas'}</p>
            </div>
            <AuditHistoryButton tableName="assignments" recordId={assignment.id} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">{ASSIGNMENT_CATEGORY_LABELS[assignment.category] ?? formatEnumLabel(assignment.category)}</Badge>
            <span className="text-xs text-ink-tertiary">Tugas/kegiatan penilaian</span>
          </div>
          <p className="mt-3 line-clamp-3 text-xs text-ink-subtle">{assignment.description || 'Tidak ada deskripsi.'}</p>
        </article>
      ))}
    </div>
  );
}
