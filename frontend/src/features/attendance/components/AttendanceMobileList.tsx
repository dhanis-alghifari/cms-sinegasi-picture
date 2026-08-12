import { Edit3, Lock } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditTable';
import { EmptyState } from '@/components/common/EmptyState';
import { AttendanceStatusBadge } from '@/components/feedback/StatusBadge';
import { Button } from '@/components/ui/button';
import { formatDateShort } from '@/shared/utils/formatDate';

import type { AttendanceRecord } from '../types/attendance.types';

interface AttendanceMobileListProps {
  records: AttendanceRecord[];
  onCorrect?: (record: AttendanceRecord) => void;
  isTeacher?: boolean;
}

export function AttendanceMobileList({ records, onCorrect, isTeacher = false }: AttendanceMobileListProps) {
  if (records.length === 0) {
    return <EmptyState title="Belum ada data absensi" description="Belum terdapat data kehadiran untuk tanggal atau kelas ini." />;
  }

  return (
    <div className="space-y-3" aria-label="Daftar absensi versi ponsel">
      {records.map((record) => (
        <article key={record.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{record.student_nama || 'Siswa'}</p>
              <p className="mt-1 truncate font-mono text-xs text-ink-subtle">{record.student_nis || 'NIS belum tersedia'} · {record.kelas || 'Kelas belum tersedia'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <AuditHistoryButton tableName="attendance" recordId={record.id} />
              {isTeacher && !record.is_locked && onCorrect && (
                <Button variant="ghost" size="icon" onClick={() => onCorrect(record)} aria-label={`Koreksi absensi ${record.student_nama || 'siswa'}`}>
                  <Edit3 size={17} className="text-primary" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Tanggal</p>
              <p className="mt-1 text-xs font-medium text-ink">{formatDateShort(record.tanggal)}</p>
            </div>
            <AttendanceStatusBadge status={record.status} />
          </div>

          <p className="mt-3 line-clamp-2 text-xs text-ink-subtle">{record.keterangan || 'Tidak ada keterangan'}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[10px]">
            {record.is_locked ? (
              <>
                <Lock size={12} className="text-semantic-warning" aria-hidden="true" />
                <span className="font-medium text-semantic-warning">Terkunci setelah 48 jam</span>
              </>
            ) : (
              <span className="font-medium text-semantic-success">Masih dapat dikoreksi</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
