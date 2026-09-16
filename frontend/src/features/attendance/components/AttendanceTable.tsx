
import { Lock, Edit3 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import { Button } from '@/shared/ui/primitives/button';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';
import { EmptyState } from '@/shared/ui/EmptyState';
import { formatDateShort } from '@/shared/utils/formatDate';
import type { AttendanceRecord } from '../types/attendance.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';

interface AttendanceTableProps {
  records: AttendanceRecord[];
  onCorrect?: (record: AttendanceRecord) => void;
  isTeacher?: boolean;
}

export function AttendanceTable({
  records,
  onCorrect,
  isTeacher = false,
}: AttendanceTableProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        title="Belum ada data absensi"
        description="Belum terdapat data kehadiran untuk tanggal atau kelas ini."
      />
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">Tanggal</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">NIS</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Nama Siswa</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Kelas</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Status Kehadiran</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Keterangan</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Lock Status (48h)</TableHead>
            <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
            {isTeacher && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {records.map((rec) => (
            <TableRow key={rec.id} className="border-hairline hover:bg-surface-2/40">
              <TableCell className="text-ink-subtle text-xs font-medium">{formatDateShort(rec.tanggal)}</TableCell>
              <TableCell className="text-ink-muted text-xs font-mono">{rec.student_nis ?? '-'}</TableCell>
              <TableCell className="text-ink font-semibold text-xs">{rec.student_nama ?? 'Siswa'}</TableCell>
              <TableCell className="text-ink-muted text-xs">{rec.kelas ?? '-'}</TableCell>

              <TableCell>
                <AttendanceStatusBadge status={rec.status} />
              </TableCell>

              <TableCell className="text-ink-subtle text-xs">
                {rec.keterangan || '-'}
              </TableCell>

              <TableCell>
                {rec.is_locked ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-semantic-warning bg-semantic-warning/15 px-2 py-0.5 rounded-full">
                    <Lock size={12} />
                    Terkunci (&gt;48 jam)
                  </span>
                ) : (
                  <span className="text-semantic-success text-xs font-medium">Terbuka</span>
                )}
              </TableCell>

              <TableCell className="text-right"><AuditHistoryButton tableName="attendance" recordId={rec.id} /></TableCell>

              {isTeacher && (
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCorrect && onCorrect(rec)}
                    className="bg-surface-2 border-hairline text-ink-subtle hover:text-ink text-xs h-7 px-2"
                  >
                    <Edit3 size={12} className="mr-1 text-primary" />
                    Koreksi Guru
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
