
import { lazy, Suspense, useState } from 'react';
import { UserPlus } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { DataTableSkeleton, RefreshingIndicator } from '@/shared/ui/LoadingSkeletons';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Pagination } from '@/shared/ui/Pagination';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { USER_ROLE_VALUES } from '@/shared/types/common';
import { isOneOf } from '@/shared/utils/isOneOf';
import { UI_CONSTANTS } from '@/shared/constants/ui';

import { useUsersQuery } from '../hooks/useUsersQuery';
import { useCreateUserMutation } from '../hooks/useCreateUserMutation';
import { useUpdateUserMutation } from '../hooks/useUpdateUserMutation';
import { useResetPasswordMutation } from '../hooks/useResetPasswordMutation';
import { useDeleteUserMutation } from '../hooks/useDeleteUserMutation';
import { UserFilter } from '../components/UserFilter';
import { UserTable } from '../components/UserTable';
import { UserMobileList } from '../components/UserMobileList';
import type { UserAccount } from '../types/users.types';
import type { UserFormValues } from '../schemas/userSchema';

const LazyUserFormDialog = lazy(() =>
  import('../components/UserFormDialog').then(({ UserFormDialog }) => ({ default: UserFormDialog })),
);
const LazyResetPasswordDialog = lazy(() =>
  import('../components/ResetPasswordDialog').then(({ ResetPasswordDialog }) => ({ default: ResetPasswordDialog })),
);
const LazyReasonDialog = lazy(() =>
  import('@/shared/ui/ActionDialog').then(({ ReasonDialog }) => ({ default: ReasonDialog })),
);

export function UsersPage() {
  const { user, updateUser: updateAuthUser } = useAuthStore();
  const isMobile = useIsMobile();
  const isTeacher = user?.role === 'teacher';

  // Filters
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [status, setStatus] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);
  const pageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;

  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);

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
    setRole(UI_CONSTANTS.ALL_FILTER_VALUE);
    setStatus(UI_CONSTANTS.ALL_FILTER_VALUE);
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
  const { data, isLoading, isFetching, isError, error, refetch } = useUsersQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    role: isOneOf(role, USER_ROLE_VALUES) ? role : undefined,
    is_active: status === UI_CONSTANTS.ALL_FILTER_VALUE ? undefined : status === 'active',
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
      setRole(UI_CONSTANTS.ALL_FILTER_VALUE);
      setStatus(UI_CONSTANTS.ALL_FILTER_VALUE);
      setPage(1);
    }
  };

  const handleResetPasswordSubmit = async (userId: string, changeReason: string) => {
    return resetMutation.mutateAsync({ id: userId, changeReason });
  };

  const userContent = (() => {
    if (isLoading) return <DataTableSkeleton columns={6} rows={6} mobile={isMobile} label="Memuat daftar akun..." />;
    if (isError && !data) {
      return <QueryErrorState title="Daftar akun belum dapat dimuat" error={error} onRetry={refetch} />;
    }

    const users = data?.data ?? [];
    const list = isMobile
      ? <UserMobileList users={users} onEdit={handleOpenEdit} onResetPassword={handleOpenReset} onToggleActive={handleToggleActive} onDelete={handleDelete} canManage={isTeacher} />
      : <UserTable users={users} onEdit={handleOpenEdit} onResetPassword={handleOpenReset} onToggleActive={handleToggleActive} onDelete={handleDelete} canManage={isTeacher} />;

    return (
      <div className="space-y-4">
        {list}
        <Pagination
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          total={data?.total ?? 0}
          pageSize={data?.pageSize ?? pageSize}
          onPageChange={setPage}
        />
      </div>
    );
  })();

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
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
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

      <RefreshingIndicator visible={isFetching && !isLoading} />
      {userContent}

      <Suspense fallback={null}>
        {formOpen && (
          <LazyUserFormDialog
            open
            onOpenChange={setFormOpen}
            userAccount={selectedUser}
            onSubmit={handleFormSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
            error={createMutation.error || updateMutation.error}
          />
        )}
        {resetOpen && resetTargetUser && (
          <LazyResetPasswordDialog
            open
            onOpenChange={setResetOpen}
            userAccount={resetTargetUser}
            onResetSubmit={handleResetPasswordSubmit}
            isLoading={resetMutation.isPending}
            error={resetMutation.error}
          />
        )}
        {activeStatusTarget && (
          <LazyReasonDialog
            dialog={{ open: true, onOpenChange: handleActiveStatusDialogChange }}
            content={{
              title: activeStatusTarget.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun',
              description: `Masukkan alasan untuk ${activeStatusTarget.is_active ? 'menonaktifkan' : 'mengaktifkan'} akun @${activeStatusTarget.username}.`,
            }}
            action={{
              confirmLabel: activeStatusTarget.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun',
              onConfirm: handleConfirmToggleActive,
            }}
            reason={{
              label: 'Alasan Perubahan *',
              placeholder: 'Contoh: Perubahan status keanggotaan pengguna...',
            }}
            destructive={activeStatusTarget.is_active}
          />
        )}
        {deleteTargetUser && (
          <LazyReasonDialog
            dialog={{
              open: true,
              onOpenChange: (open) => { if (!open) setDeleteTargetUser(null); },
            }}
            content={{
              title: 'Hapus Akun Permanen',
              description: `Akun tanpa tautan siswa @${deleteTargetUser.username} akan dihapus permanen. Akun yang masih terhubung ke data siswa hanya dapat dihapus melalui purge data siswa nonaktif.`,
            }}
            action={{ confirmLabel: 'Hapus Akun', onConfirm: handleConfirmDelete }}
            reason={{ label: 'Alasan Penghapusan *', placeholder: 'Contoh: Akun duplikat dan tidak memiliki histori' }}
            destructive
          />
        )}
      </Suspense>
    </div>
  );
}
