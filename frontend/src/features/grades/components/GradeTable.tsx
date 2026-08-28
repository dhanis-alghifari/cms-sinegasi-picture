// src/features/grades/components/GradeTable.tsx
// Table for student grades displaying student, assignment title, category, grade A-E badge, and date

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatEnumLabel } from '@/shared/utils/formatLabels';
import { ASSIGNMENT_CATEGORY_LABELS, type StudentGrade } from '../types/grades.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditTable';

interface GradeTableProps {
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

const gradePredicates: Record<string, string> = {
  A: 'Sangat Baik',
  B: 'Baik',
  C: 'Cukup',
  D: 'Kurang',
  E: 'Sangat Kurang',
};

export function GradeTable({ grades, isPersonal = false }: GradeTableProps) {
  if (grades.length === 0) {
    return (
      <EmptyState
        title="Belum ada data nilai"
        description="Belum ada penilaian siswa terdaftar untuk filter ini."
      />
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">Tanggal</TableHead>
            {!isPersonal && <TableHead className="text-ink-subtle text-xs font-semibold">NIS</TableHead>}
            {!isPersonal && <TableHead className="text-ink-subtle text-xs font-semibold">Nama Siswa</TableHead>}
            {!isPersonal && <TableHead className="text-ink-subtle text-xs font-semibold">Kelas</TableHead>}
            <TableHead className="text-ink-subtle text-xs font-semibold">Judul Tugas / Kegiatan</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Kategori</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Nilai (A-E)</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Keterangan</TableHead>
            <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {grades.map((g) => (
            <TableRow key={g.id} className="border-hairline hover:bg-surface-2/40">
              <TableCell className="text-ink-subtle text-xs">{formatDateShort(g.created_at)}</TableCell>
              {!isPersonal && <TableCell className="text-ink-muted text-xs font-mono">{g.student_nis ?? '-'}</TableCell>}
              {!isPersonal && <TableCell className="text-ink font-semibold text-xs">{g.student_nama ?? 'Siswa'}</TableCell>}
              {!isPersonal && <TableCell className="text-ink-muted text-xs">{g.kelas ?? '-'}</TableCell>}
              <TableCell className="text-ink font-medium text-xs">{g.assignment_title ?? 'Evaluasi'}</TableCell>
              <TableCell className="text-ink-subtle text-xs">
                {g.assignment_category ? (ASSIGNMENT_CATEGORY_LABELS[g.assignment_category] ?? formatEnumLabel(g.assignment_category)) : 'Kelas'}
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs px-2.5 py-0.5 rounded ${gradeBadgeColors[g.nilai] ?? ''}`}>
                    {g.nilai}
                  </Badge>
                  <span className="text-[11px] text-ink-tertiary">({gradePredicates[g.nilai] ?? ''})</span>
                </div>
              </TableCell>

              <TableCell className="text-ink-subtle text-xs">{g.keterangan || '-'}</TableCell>
              <TableCell className="text-right"><AuditHistoryButton tableName="grades" recordId={g.id} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
