import { AuditHistoryButton } from '@/features/audit/components/AuditTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatEnumLabel } from '@/shared/utils/formatLabels';

import { ASSIGNMENT_CATEGORY_LABELS, type StudentGrade } from '../types/grades.types';

interface GradeMobileListProps {
  grades: StudentGrade[];
  isPersonal?: boolean;
}

const gradeBadgeColors: Record<string, string> = {
  A: 'bg-semantic-success/20 text-semantic-success border-semantic-success/30 font-bold',
  B: 'bg-primary/20 text-primary border-primary/30 font-bold',
  C: 'bg-semantic-warning/20 text-semantic-warning border-semantic-warning/30 font-bold',
  D: 'bg-semantic-warning/20 text-semantic-warning border-semantic-warning/30 font-bold',
  E: 'bg-semantic-danger/20 text-semantic-danger border-semantic-danger/30 font-bold',
};

const gradePredicates: Record<string, string> = { A: 'Sangat Baik', B: 'Baik', C: 'Cukup', D: 'Kurang', E: 'Sangat Kurang' };

export function GradeMobileList({ grades, isPersonal = false }: GradeMobileListProps) {
  if (grades.length === 0) return <EmptyState title="Belum ada data nilai" description="Belum ada penilaian siswa terdaftar untuk filter ini." />;

  return (
    <div className="space-y-3" aria-label="Daftar nilai versi ponsel">
      {grades.map((grade) => (
        <article key={grade.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {!isPersonal && <p className="truncate text-sm font-semibold text-ink">{grade.student_nama || 'Siswa'}</p>}
              {!isPersonal && <p className="mt-1 truncate text-xs text-ink-tertiary">{grade.student_nis || 'NIS belum tersedia'} · {grade.kelas || 'Kelas belum tersedia'}</p>}
              {isPersonal && <p className="truncate text-sm font-semibold text-ink">{grade.assignment_title || 'Evaluasi'}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className={`rounded px-2.5 py-1 text-sm ${gradeBadgeColors[grade.nilai] ?? ''}`}>{grade.nilai}</Badge>
              <AuditHistoryButton tableName="grades" recordId={grade.id} />
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-surface-2 p-3">
            <p className="line-clamp-2 text-sm font-medium text-ink">{isPersonal ? 'Nilai diterbitkan' : (grade.assignment_title || 'Evaluasi')}</p>
            <p className="mt-1 text-xs text-ink-subtle">{grade.assignment_category ? (ASSIGNMENT_CATEGORY_LABELS[grade.assignment_category] ?? formatEnumLabel(grade.assignment_category)) : 'Kelas'} · {formatDateShort(grade.created_at)}</p>
          </div>
          <p className="mt-2 text-xs text-ink-subtle">{grade.keterangan || gradePredicates[grade.nilai] || 'Tidak ada keterangan'}</p>
        </article>
      ))}
    </div>
  );
}
