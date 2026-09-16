
import { MoreVertical, Edit2, KeyRound, Trash2, UserCheck, UserX, ShieldAlert } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { Button } from '@/shared/ui/primitives/button';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { EmptyState } from '@/shared/ui/EmptyState';

import type { UserAccount } from '../types/users.types';
import { formatRoleLabel } from '@/shared/utils/formatLabels';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { ActorSummaryText } from './ActorSummaryText';

interface UserTableProps {
  users: UserAccount[];
  onEdit: (user: UserAccount) => void;
  onResetPassword: (user: UserAccount) => void;
  onToggleActive: (user: UserAccount) => void;
  onDelete: (user: UserAccount) => void;
  canManage?: boolean;
}

export function UserTable({
  users,
  onEdit,
  onResetPassword,
  onToggleActive,
  onDelete,
  canManage = true,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <EmptyState
        title="Tidak ada data akun pengguna"
        description="Belum ada akun pengguna terdaftar yang sesuai dengan filter pencarian saat ini."
      />
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">Username</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Nama Lengkap</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Role Akses</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Status Login</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Status Akun</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Audit Aktor</TableHead>
            <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
            {canManage && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className="border-hairline hover:bg-surface-2/40">
              <TableCell className="text-ink font-mono text-xs font-medium">@{user.username}</TableCell>
              <TableCell className="text-ink font-medium text-xs">{user.nama}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {formatRoleLabel(user.role)}
                  </span>
                  {user.is_linked_student && <span className="text-[10px] text-ink-subtle">Akun siswa</span>}
                </div>
              </TableCell>
              <TableCell>
                {user.is_first_login ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-semantic-warning bg-semantic-warning/15 px-2 py-0.5 rounded-full">
                    <ShieldAlert size={12} />
                    Wajib Ganti Password
                  </span>
                ) : (
                  <span className="text-ink-tertiary text-xs">Sudah Ganti</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={user.is_active ? 'Aktif' : 'Nonaktif'}
                  variant={user.is_active ? 'success' : 'danger'}
                />
              </TableCell>
              <TableCell><ActorSummaryText actor={user.updated_actor || user.created_actor} /></TableCell>
              <TableCell className="text-right"><AuditHistoryButton tableName="users" recordId={user.id} /></TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-ink-subtle hover:text-ink">
                          <MoreVertical size={14} />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="bg-surface-3 border-hairline text-ink">
                      <DropdownMenuItem onClick={() => onEdit(user)} className="text-xs cursor-pointer">
                        <Edit2 size={14} className="mr-2 text-ink-subtle" />
                        Edit Akun
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onResetPassword(user)} className="text-xs cursor-pointer">
                        <KeyRound size={14} className="mr-2 text-primary" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleActive(user)} className="text-xs cursor-pointer">
                        {user.is_active ? (
                          <>
                            <UserX size={14} className="mr-2 text-semantic-warning" />
                            Nonaktifkan Akun
                          </>
                        ) : (
                          <>
                            <UserCheck size={14} className="mr-2 text-semantic-success" />
                            Aktifkan Kembali
                          </>
                        )}
                      </DropdownMenuItem>
                      {!user.is_linked_student && user.role !== 'member' && (
                        <DropdownMenuItem onClick={() => onDelete(user)} className="text-xs cursor-pointer text-semantic-danger focus:text-semantic-danger">
                          <Trash2 size={14} className="mr-2" />
                          Hapus Akun Operasional
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
