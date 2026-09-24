import { KeyRound, Link2, MoreVertical, Trash2, UserCheck, UserRound, UserX } from 'lucide-react';
import { Button } from '@/shared/ui/primitives/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/primitives/dropdown-menu';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { EmptyState } from '@/shared/ui/EmptyState';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import type { Student } from '../types/students.types';

interface StudentMobileListProps {
  students: Student[];
  onOpenDetail: (student: Student) => void;
  onEdit: (student: Student) => void;
  onToggleActive: (student: Student) => void;
  onDelete?: (student: Student) => void;
  onProvisionAccount?: (student: Student) => void;
  onLinkLegacyAccount?: (student: Student) => void;
  canManage?: boolean;
  canManageStatus?: boolean;
}

function StudentAvatar({ student }: { student: Student }) {
  return student.foto_url ? (
    <img src={student.foto_url} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-hairline bg-surface-2 object-cover" />
  ) : (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-3 text-lg font-semibold uppercase text-ink-subtle">
      {student.nama.charAt(0)}
    </div>
  );
}

export function StudentMobileList({
  students,
  onOpenDetail,
  onEdit,
  onToggleActive,
  onDelete,
  onProvisionAccount,
  onLinkLegacyAccount,
  canManage = true,
  canManageStatus = false,
}: StudentMobileListProps) {
  if (students.length === 0) {
    return <EmptyState title="Tidak ada data siswa" description="Belum ada siswa yang sesuai dengan filter saat ini." />;
  }

  return (
    <div className="space-y-3" aria-label="Daftar siswa versi ponsel">
      {students.map((student) => (
        <article key={student.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => onOpenDetail(student)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <StudentAvatar student={student} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{student.nama}</span>
                <span className="mt-0.5 block truncate font-mono text-xs text-ink-subtle">{student.nis}</span>
                <span className="mt-1 block truncate text-xs text-ink-tertiary">{student.kelas} · {student.peminatan ?? 'Peminatan belum diatur'}</span>
              </span>
            </button>

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="shrink-0 text-ink-subtle" aria-label={`Aksi untuk ${student.nama}`} />}>
                  <MoreVertical size={18} aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-surface-3 border-hairline text-ink">
                  <DropdownMenuItem onClick={() => onOpenDetail(student)} className="min-h-11 cursor-pointer text-sm">Lihat detail</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(student)} className="min-h-11 cursor-pointer text-sm">Edit data</DropdownMenuItem>
                  {canManageStatus && !student.user_id && onProvisionAccount && (
                    <DropdownMenuItem onClick={() => onProvisionAccount(student)} className="min-h-11 cursor-pointer text-sm">
                      <KeyRound size={16} className="mr-2 text-primary" aria-hidden="true" />
                      Buat akun anggota
                    </DropdownMenuItem>
                  )}
                  {canManageStatus && student.is_active && !student.user_id && onLinkLegacyAccount && (
                    <DropdownMenuItem onClick={() => onLinkLegacyAccount(student)} className="min-h-11 cursor-pointer text-sm">
                      <Link2 size={16} className="mr-2 text-primary" aria-hidden="true" />
                      Tautkan akun lama
                    </DropdownMenuItem>
                  )}
                  {canManageStatus && (
                    <DropdownMenuItem onClick={() => onToggleActive(student)} className="min-h-11 cursor-pointer text-sm">
                      {student.is_active ? <><UserX size={16} className="mr-2 text-semantic-warning" aria-hidden="true" />Nonaktifkan sebagai alumni</>
                        : <><UserCheck size={16} className="mr-2 text-semantic-success" aria-hidden="true" />Aktifkan kembali</>}
                    </DropdownMenuItem>
                  )}
                  {canManageStatus && !student.is_active && onDelete && (
                    <DropdownMenuItem onClick={() => onDelete(student)} className="min-h-11 cursor-pointer text-sm text-semantic-danger focus:text-semantic-danger">
                      <Trash2 size={16} className="mr-2" aria-hidden="true" />Hapus data permanen
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-lg bg-surface-2 px-3">
            <button type="button" onClick={() => onOpenDetail(student)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-xs text-ink-subtle hover:text-ink">
              <UserRound size={15} aria-hidden="true" />
              <span className="truncate">{student.user_id ? 'Akun login terhubung' : 'Akun login belum dibuat'}</span>
            </button>
            <span className="flex items-center gap-2">
              <StatusBadge label={student.is_active ? 'Aktif' : 'Alumni'} variant={student.is_active ? 'success' : 'neutral'} />
              <AuditHistoryButton tableName="students" recordId={student.id} />
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
