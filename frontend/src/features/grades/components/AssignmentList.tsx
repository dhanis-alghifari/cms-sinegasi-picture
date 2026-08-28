// List of assignments/tasks. This is intentionally separate from GradeTable:
// an assignment exists before any student has been graded for it.

import { ClipboardList } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getErrorMessage } from '@/shared/api/errors';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatEnumLabel } from '@/shared/utils/formatLabels';
import { useIsMobile } from '@/hooks/use-mobile';

import { ASSIGNMENT_CATEGORY_LABELS, type Assignment } from '../types/grades.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditTable';
import { AssignmentMobileList } from './AssignmentMobileList';

interface AssignmentListProps {
  assignments: Assignment[];
  isLoading?: boolean;
  error?: unknown;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isOwn?: boolean;
}

export function AssignmentList({
  assignments,
  isLoading = false,
  error,
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  isOwn = false,
}: AssignmentListProps) {
  const isMobile = useIsMobile();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-ink text-sm font-semibold">{isOwn ? 'Tugas Saya' : 'Daftar Tugas / Kegiatan Penilaian'}</h2>
        <p className="text-ink-subtle text-xs mt-1">
          {isOwn ? 'Tugas dan kegiatan yang ditujukan untuk kelas Anda.' : 'Tugas tetap tampil meskipun belum ada siswa yang dinilai.'}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-hairline bg-surface-1 px-4 py-10 text-center text-ink-subtle text-sm">
          Memuat daftar tugas...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 px-4 py-4 text-semantic-danger text-sm">
          Gagal memuat daftar tugas: {getErrorMessage(error)}
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-lg border border-hairline bg-surface-1">
          <EmptyState
            icon={ClipboardList}
            title="Belum ada tugas penilaian"
            description="Buat tugas atau kegiatan baru agar dapat digunakan untuk penilaian siswa."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {isMobile ? <AssignmentMobileList assignments={assignments} isOwn={isOwn} /> : <div className="rounded-lg border border-hairline bg-surface-1 overflow-x-auto">
            <Table>
              <TableHeader className="bg-surface-2/60">
                <TableRow className="border-hairline">
                  <TableHead className="text-ink-subtle text-xs font-semibold">Tanggal</TableHead>
                  <TableHead className="text-ink-subtle text-xs font-semibold">Judul</TableHead>
                  <TableHead className="text-ink-subtle text-xs font-semibold">Kategori</TableHead>
                  {!isOwn && <TableHead className="text-ink-subtle text-xs font-semibold">Kelas</TableHead>}
                  <TableHead className="text-ink-subtle text-xs font-semibold">Deskripsi</TableHead>
                  <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id} className="border-hairline hover:bg-surface-2/40">
                    <TableCell className="text-ink-subtle text-xs whitespace-nowrap">
                      {formatDateShort(assignment.date)}
                    </TableCell>
                    <TableCell className="text-ink text-xs font-medium whitespace-nowrap">
                      {assignment.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-medium">
                        {ASSIGNMENT_CATEGORY_LABELS[assignment.category] ?? formatEnumLabel(assignment.category)}
                      </Badge>
                    </TableCell>
                    {!isOwn && <TableCell className="text-ink-muted text-xs whitespace-nowrap">{assignment.kelas || 'Semua kelas'}</TableCell>}
                    <TableCell className="text-ink-subtle text-xs min-w-56">
                      {assignment.description || '-'}
                    </TableCell>
                    <TableCell className="text-right"><AuditHistoryButton tableName="assignments" recordId={assignment.id} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </section>
  );
}
