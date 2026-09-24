import { Edit2, KeyRound, MoreVertical, Trash2, UserCheck, UserX } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { useCanViewAuditHistory } from '@/features/audit/hooks/useCanViewAuditHistory';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Button } from '@/shared/ui/primitives/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/primitives/dropdown-menu';
import { formatRoleLabel } from '@/shared/utils/formatLabels';
import { ActorSummaryText } from './ActorSummaryText';

import type { UserAccount } from '../types/users.types';
import { canDeleteUnlinkedAccount } from '../utils/userAccountPolicy';

interface UserMobileListProps {
  users: UserAccount[];
  onEdit: (user: UserAccount) => void;
  onResetPassword: (user: UserAccount) => void;
  onToggleActive: (user: UserAccount) => void;
  onDelete: (user: UserAccount) => void;
  canManage?: boolean;
}

export function UserMobileList({ users, onEdit, onResetPassword, onToggleActive, onDelete, canManage = true }: UserMobileListProps) {
  const canViewAuditHistory = useCanViewAuditHistory();

  if (users.length === 0) return <EmptyState title="Tidak ada data akun pengguna" description="Belum ada akun pengguna terdaftar yang sesuai dengan filter pencarian saat ini." />;

  return (
    <div className="space-y-3" aria-label="Daftar pengguna versi ponsel">
      {users.map((user) => (
        <article key={user.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.nama}</p>
              <p className="mt-1 truncate font-mono text-xs text-ink-subtle">@{user.username}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <AuditHistoryButton tableName="users" recordId={user.id} />
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="text-ink-subtle" aria-label={`Aksi untuk ${user.nama}`} />}>
                    <MoreVertical size={18} aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-hairline bg-surface-3 text-ink">
                    <DropdownMenuItem onClick={() => onEdit(user)} className="min-h-11 cursor-pointer text-sm"><Edit2 size={16} className="mr-2" aria-hidden="true" />Edit akun</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onResetPassword(user)} className="min-h-11 cursor-pointer text-sm"><KeyRound size={16} className="mr-2 text-primary" aria-hidden="true" />Reset password</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleActive(user)} className="min-h-11 cursor-pointer text-sm">
                      {user.is_active ? <><UserX size={16} className="mr-2 text-semantic-warning" aria-hidden="true" />Nonaktifkan akun</> : <><UserCheck size={16} className="mr-2 text-semantic-success" aria-hidden="true" />Aktifkan kembali</>}
                    </DropdownMenuItem>
                    {canDeleteUnlinkedAccount(user) && <DropdownMenuItem onClick={() => onDelete(user)} className="min-h-11 cursor-pointer text-sm text-semantic-danger focus:text-semantic-danger"><Trash2 size={16} className="mr-2" aria-hidden="true" />Hapus akun permanen</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-surface-2 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{formatRoleLabel(user.role)}</span>
              {user.is_linked_student && <span className="text-[10px] text-ink-subtle">Akun siswa</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-ink-tertiary">{user.is_first_login ? 'Wajib ganti password' : 'Password aktif'}</span>
              <StatusBadge label={user.is_active ? 'Aktif' : 'Nonaktif'} variant={user.is_active ? 'success' : 'danger'} />
            </div>
          </div>
          {canViewAuditHistory && (
            <div className="mt-2 border-t border-hairline pt-2">
              <ActorSummaryText actor={user.updated_actor || user.created_actor} />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
