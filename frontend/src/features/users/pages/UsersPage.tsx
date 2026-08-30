// src/features/users/pages/UsersPage.tsx
// Thin orchestration page for User Accounts & Role Management (Teacher/Admin only)

import { useState } from 'react';
import { UserPlus } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Pagination } from '@/shared/ui/Pagination';
import { ReasonDialog } from '@/shared/ui/ActionDialog';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { USER_ROLE_VALUES } from '@/shared/types/common';
import { isOneOf } from '@/shared/utils/isOneOf';

import { useUsersQuery } from '../hooks/useUsersQuery';
import { useCreateUserMutation } from '../hooks/useCreateUserMutation';
import { useUpdateUserMutation } from '../hooks/useUpdateUserMutation';
import { useResetPasswordMutation } from '../hooks/useResetPasswordMutation';
import { useDeleteUserMutation } from '../hooks/useDeleteUserMutation';
import { UserFilter } from '../components/UserFilter';
import { UserTable } from '../components/UserTable';
import { UserMobileList } from '../components/UserMobileList';
import { UserFormDialog } from '../components/UserFormDialog';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
import type { UserAccount } from '../types/users.types';
import type { UserFormValues } from '../schemas/userSchema';

export function UsersPage() {
  const { user, updateUser: updateAuthUser } = useAuthStore();
  const isMobile = useIsMobile();
  const isTeacher = user?.role === 'teacher';

  // Filters
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const debouncedSearch = useDebouncedValue(search, 300);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleRoleChange = (val: string) => {
    setRole(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleResetFilter = () => {
    setSearch('');
    setRole('all');
    setStatus('all');
    setPage(1);
  };

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserAccount | null>(null);
  const [activeStatusTarget, setActiveStatusTarget] = useState<UserAccount | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserAccount | null>(null);

  // Queries & Mutations
  const { data, isLoading } = useUsersQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    role: isOneOf(role, USER_ROLE_VALUES) ? role : undefined,
    is_active: status === 'all' ? undefined : status === 'active',
  });

  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const resetMutation = useResetPasswordMutation();
  const deleteMutation = useDeleteUserMutation();

  const handleOpenAdd = () => {
    createMutation.reset();
    updateMutation.reset();
    setSelectedUser(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (userAccount: UserAccount) => {
    createMutation.reset();
    updateMutation.reset();
    setSelectedUser(userAccount);
    setFormOpen(true);
  };

  const handleOpenReset = (userAccount: UserAccount) => {
    resetMutation.reset();
    setResetTargetUser(userAccount);
    setResetOpen(true);
  };

  const handleToggleActive = (userAccount: UserAccount) => {
    setActiveStatusTarget(userAccount);
  };

  const handleDelete = (userAccount: UserAccount) => {
    deleteMutation.reset();
    setDeleteTargetUser(userAccount);
  };

  const handleConfirmDelete = async (reason: string) => {
    if (!deleteTargetUser) return;
    await deleteMutation.mutateAsync({ id: deleteTargetUser.id, changeReason: reason });
    setDeleteTargetUser(null);
  };

  const handleConfirmToggleActive = async (reason: string) => {
    if (!activeStatusTarget) return;

    await updateMutation.mutateAsync({
      id: activeStatusTarget.id,
      payload: { is_active: !activeStatusTarget.is_active },
      changeReason: reason,
    });
  };

  const handleActiveStatusDialogChange = (open: boolean) => {
    if (!open) {
      setActiveStatusTarget(null);
    }
  };

  const handleFormSubmit = async (values: UserFormValues) => {
    const { change_reason, ...payload } = values;

    if (selectedUser) {
      const updatedUser = await updateMutation.mutateAsync({
        id: selectedUser.id,
        payload: {
          username: payload.username,
          nama: payload.nama,
          role: payload.role,
        },
        changeReason: change_reason ?? '',
      });
      if (user?.id === updatedUser.id) {
        updateAuthUser({
          ...user,
          username: updatedUser.username,
          nama: updatedUser.nama,
          role: updatedUser.role,
          is_active: updatedUser.is_active,
          is_first_login: updatedUser.is_first_login,
        });
      }
    } else {
      await createMutation.mutateAsync({
        payload: {
          username: payload.username,
          nama: payload.nama,
          role: payload.role,
          password: payload.password || undefined,
        },
      });
      setSearch('');
      setRole('all');
      setStatus('all');
      setPage(1);
    }
  };

  const handleResetPasswordSubmit = async (userId: string, changeReason: string) => {
    return resetMutation.mutateAsync({ id: userId, changeReason });
  };

  if (!isTeacher) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-5 sm:p-6">
        <EmptyState
          title="Akses Dibatasi"
          description="Halaman Manajemen Pengguna hanya dapat diakses oleh Guru Pembina (Teacher)."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Manajemen Pengguna & Akses"
        subtitle="Kelola akun pengguna, penetapan 8 tingkatan peran (RBAC), reset password, dan status keaktifan."
        actions={
          <ResponsivePageActions
            actions={[{
              id: 'add-operational-account',
              label: 'Tambah Akun Operasional',
              icon: UserPlus,
              onSelect: handleOpenAdd,
            }]}
          />
        }
      />

      <UserFilter
        search={search}
        onSearchChange={handleSearchChange}
        role={role}
        onRoleChange={handleRoleChange}
        status={status}
        onStatusChange={handleStatusChange}
        onReset={handleResetFilter}
      />

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          {isMobile ? (
            <UserMobileList
              users={data?.data ?? []}
              onEdit={handleOpenEdit}
              onResetPassword={handleOpenReset}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              canManage={isTeacher}
            />
          ) : (
            <UserTable
              users={data?.data ?? []}
              onEdit={handleOpenEdit}
              onResetPassword={handleOpenReset}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              canManage={isTeacher}
            />
          )}
          <Pagination
            page={data?.page ?? page}
            totalPages={data?.totalPages ?? 1}
            total={data?.total ?? 0}
            pageSize={data?.pageSize ?? pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        userAccount={selectedUser}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        error={createMutation.error || updateMutation.error}
      />

      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        userAccount={resetTargetUser}
        onResetSubmit={handleResetPasswordSubmit}
        isLoading={resetMutation.isPending}
        error={resetMutation.error}
      />

      <ReasonDialog
        open={Boolean(activeStatusTarget)}
        onOpenChange={handleActiveStatusDialogChange}
        title={activeStatusTarget?.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
        description={activeStatusTarget
          ? `Masukkan alasan untuk ${activeStatusTarget.is_active ? 'menonaktifkan' : 'mengaktifkan'} akun @${activeStatusTarget.username}.`
          : ''}
        reasonLabel="Alasan Perubahan *"
        reasonPlaceholder="Contoh: Perubahan status keanggotaan pengguna..."
        confirmLabel={activeStatusTarget?.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
        destructive={Boolean(activeStatusTarget?.is_active)}
        onConfirm={handleConfirmToggleActive}
      />

      <ReasonDialog
        open={Boolean(deleteTargetUser)}
        onOpenChange={(open) => { if (!open) setDeleteTargetUser(null); }}
        title="Hapus Akun Operasional"
        description={deleteTargetUser
          ? `Akun @${deleteTargetUser.username} akan dihapus permanen. Akun yang terhubung ke siswa tidak dapat dihapus; gunakan status Alumni dari halaman Data Siswa.`
          : ''}
        reasonLabel="Alasan Penghapusan *"
        reasonPlaceholder="Contoh: Akun duplikat dan tidak memiliki histori"
        confirmLabel="Hapus Akun"
        destructive
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
