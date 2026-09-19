
import { ClipboardList } from 'lucide-react';

import { EmptyState } from '@/shared/ui/EmptyState';
import { Pagination } from '@/shared/ui/Pagination';
import { Badge } from '@/shared/ui/primitives/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/primitives/table';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { DataTableSkeleton } from '@/shared/ui/LoadingSkeletons';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatEnumLabel } from '@/shared/utils/formatLabels';
import { useIsMobile } from '@/shared/hooks/use-mobile';

import { ASSIGNMENT_CATEGORY_LABELS, type Assignment } from '../types/grades.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { AssignmentMobileList } from './AssignmentMobileList';

interface AssignmentListProps {
  data: {
    assignments: Assignment[];
    isLoading?: boolean;
    error?: unknown;
    isError?: boolean;
  };
  pagination: {
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  view?: {
    isOwn?: boolean;
  };
  actions?: {
    onRetry?: () => void;
  };
}

export function AssignmentList({
  data,
  pagination,
  view,
  actions,
}: AssignmentListProps) {
  const {
    assignments,
    isLoading = false,
    error,
    isError = Boolean(error),
  } = data;
  const { page, totalPages, total, pageSize, onPageChange } = pagination;
  const { isOwn = false } = view ?? {};
  const { onRetry } = actions ?? {};
  const isMobile = useIsMobile();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-ink text-sm font-semibold">{isOwn ? 'Tugas Saya' : 'Daftar Tugas / Kegiatan Penilaian'}</h2>
        <p className="text-ink-subtle text-xs mt-1">
          {isOwn ? 'Tugas dan kegiatan yang ditujukan untuk kelas Anda.' : 'Tugas tetap tampil meskipun belum ada siswa yang dinilai.'}
        </p>
      </div>

      {isLoading && (
        <DataTableSkeleton columns={isOwn ? 5 : 6} rows={5} mobile={isMobile} label="Memuat daftar tugas..." />
      )}
      {isError && (
        <QueryErrorState
          title="Daftar tugas belum dapat dimuat"
          error={error}
          onRetry={onRetry}
        />
      )}
      {!isLoading && !isError && assignments.length === 0 && (
        <div className="rounded-lg border border-hairline bg-surface-1">
          <EmptyState
            icon={ClipboardList}
            title="Belum ada tugas penilaian"
            description="Buat tugas atau kegiatan baru agar dapat digunakan untuk penilaian siswa."
          />
        </div>
      )}
      {!isLoading && !isError && assignments.length > 0 && (
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
