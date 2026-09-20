
import { useState } from 'react';
import { AlertCircle, Plus, Search, Layers, Edit2, Power } from 'lucide-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { DataTableSkeleton } from '@/shared/ui/LoadingSkeletons';
import { Pagination } from '@/shared/ui/Pagination';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { ReasonDialog } from '@/shared/ui/ActionDialog';
import { getErrorMessage } from '@/shared/api/errors';
import { useClassesQuery } from '../hooks/useClassesQuery';
import { useCreateClassMutation } from '../hooks/useCreateClassMutation';
import { useUpdateClassMutation } from '../hooks/useUpdateClassMutation';
import { ClassFormDialog } from '../components/ClassFormDialog';
import { ClassMobileList } from '../components/ClassMobileList';
import type { ClassRecord } from '../types/classes.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { useCanViewAuditHistory } from '@/features/audit/hooks/useCanViewAuditHistory';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { hasCapability } from '@/shared/auth/capabilities';

export function ClassesPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'classes.manage');
  const canViewAuditHistory = useCanViewAuditHistory();
  const [search, setSearch] = useState('');
  const [tingkatFilter, setTingkatFilter] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);
  const pageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;

  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    item: ClassRecord;
    nextStatus: boolean;
    actionName: string;
  } | null>(null);

  const classesQuery = useClassesQuery({
    search: debouncedSearch || undefined,
    tingkat: tingkatFilter !== UI_CONSTANTS.ALL_FILTER_VALUE ? tingkatFilter : undefined,
    page,
    pageSize,
  });
  const createMutation = useCreateClassMutation();
  const updateMutation = useUpdateClassMutation();

  const classes = classesQuery.data?.data ?? [];

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleTingkatChange = (val: string) => {
    setTingkatFilter(val);
    setPage(1);
  };

  const handleTingkatFilterChange = (value: string | null) => {
    if (!value) return;
    handleTingkatChange(value);
  };

  const handleOpenAdd = () => {
    createMutation.reset();
    updateMutation.reset();
    setEditingClass(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: ClassRecord) => {
    createMutation.reset();
    updateMutation.reset();
    setEditingClass(item);
    setDialogOpen(true);
  };

  const handleToggleStatus = (item: ClassRecord) => {
    const nextStatus = !item.is_active;
    const actionName = nextStatus ? 'mengaktifkan' : 'menonaktifkan';
    setStatusTarget({ item, nextStatus, actionName });
  };

  const handleConfirmStatus = async (reason: string) => {
    if (!statusTarget) return;

    await updateMutation.mutateAsync({
      id: statusTarget.item.id,
      payload: {
        is_active: statusTarget.nextStatus,
        change_reason: reason,
      },
    });
  };

  const handleStatusDialogChange = (open: boolean) => {
    if (!open) {
      setStatusTarget(null);
    }
  };

  const handleSubmitForm = async (values: { nama_kelas: string; tingkat: string; change_reason?: string }) => {
    if (editingClass) {
      await updateMutation.mutateAsync({
        id: editingClass.id,
        payload: values,
      });
      return;
    }

    await createMutation.mutateAsync({
      payload: {
        nama_kelas: values.nama_kelas,
        tingkat: values.tingkat,
      },
    });
    setSearch('');
    setTingkatFilter(UI_CONSTANTS.ALL_FILTER_VALUE);
    setPage(1);
  };

  return (
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Master Kelas"
        subtitle="Kelola daftar kelas terstruktur (TKJ, AK, TB, PH) untuk digunakan di data siswa & absensi."
        actions={
          canManage ? <ResponsivePageActions
              actions={[{
                id: 'add-class',
                label: 'Tambah Kelas',
                icon: Plus,
                onSelect: handleOpenAdd,
              }]}
            /> : undefined
        }
      />

      {/* Filter & Search Bar */}
      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <Input
            type="text"
            aria-label="Cari kelas"
            placeholder="Cari nama kelas (misal: TKJ 1, AK 5)..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 w-full min-w-0 bg-surface-1 pl-9 text-xs text-ink placeholder:text-ink-tertiary"
          />
        </div>

        <Select value={tingkatFilter} onValueChange={handleTingkatFilterChange}>
          <SelectTrigger aria-label="Filter tingkat kelas" className="h-9 w-full bg-surface-1 text-xs text-ink lg:w-40">
            <SelectValue placeholder="Tingkat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua Tingkat</SelectItem>
            <SelectItem value="X">Tingkat X</SelectItem>
            <SelectItem value="XI">Tingkat XI</SelectItem>
            <SelectItem value="XII">Tingkat XII</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Classes Table */}
      {classesQuery.isPending && (
        <DataTableSkeleton columns={3 + Number(canManage) + Number(canViewAuditHistory)} rows={5} mobile={isMobile} label="Memuat daftar kelas..." />
      )}
      {classesQuery.isError && (
        <div
          className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-semantic-danger/30 bg-semantic-danger/5 px-4 text-center"
          role="alert"
        >
          <AlertCircle className="h-8 w-8 text-semantic-danger" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-ink">Data kelas belum dapat dimuat</p>
            <p className="mt-1 text-xs text-ink-subtle">{getErrorMessage(classesQuery.error)}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void classesQuery.refetch()}
            className="border-hairline text-xs text-ink"
          >
            Coba lagi
          </Button>
        </div>
      )}
      {!classesQuery.isPending && !classesQuery.isError && (
        <div className="space-y-4">
          {classesQuery.isFetching && (
            <p className="text-right text-[11px] text-ink-tertiary" aria-live="polite">
              Memperbarui data...
            </p>
          )}
          {isMobile && <ClassMobileList classes={classes} onEdit={handleOpenEdit} onToggleStatus={handleToggleStatus} canManage={canManage} />}
          {!isMobile && <div className="overflow-hidden rounded-lg border border-hairline bg-surface-1">
            <Table>
              <TableHeader className="bg-surface-2/60">
                <TableRow className="border-hairline">
                  <TableHead className="text-ink-subtle text-xs font-semibold">Nama Kelas</TableHead>
                  <TableHead className="text-ink-subtle text-xs font-semibold">Tingkat</TableHead>
                  <TableHead className="text-ink-subtle text-xs font-semibold">Status</TableHead>
                  {canViewAuditHistory && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>}
                  {canManage && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.length === 0 && (
                  <TableRow className="border-hairline">
                    <TableCell colSpan={3 + Number(canManage) + Number(canViewAuditHistory)} className="py-8 text-center text-ink-tertiary">
                      <Layers className="mx-auto h-8 w-8 text-ink-tertiary mb-2 opacity-50" />
                      Tidak ada kelas yang ditemukan.
                    </TableCell>
                  </TableRow>
                )}
                {classes.length > 0 && classes.map((cls) => (
                    <TableRow key={cls.id} className="border-hairline hover:bg-surface-2/40">
                      <TableCell className="text-ink text-xs font-medium">{cls.nama_kelas}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-2 border border-hairline text-ink-subtle">
                          Tingkat {cls.tingkat}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            cls.is_active
                              ? 'bg-semantic-success/15 text-semantic-success'
                              : 'bg-ink-tertiary/15 text-ink-muted'
                          }`}
                        >
                          {cls.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </TableCell>
                      {canViewAuditHistory && <TableCell className="text-right"><AuditHistoryButton tableName="classes" recordId={cls.id} /></TableCell>}
                      {canManage && <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(cls)}
                            className="h-7 w-7 p-0 text-ink-subtle hover:text-ink hover:bg-surface-2"
                            title="Edit Kelas"
                          >
                            <Edit2 size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(cls)}
                            className={`h-7 w-7 p-0 ${
                              cls.is_active
                                ? 'text-semantic-danger hover:bg-semantic-danger/10'
                                : 'text-semantic-success hover:bg-semantic-success/10'
                            }`}
                            title={cls.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            <Power size={13} />
                          </Button>
                        </div>
                      </TableCell>}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>}

          <Pagination
            page={classesQuery.data?.page ?? page}
            totalPages={classesQuery.data?.totalPages ?? 1}
            total={classesQuery.data?.total ?? 0}
            pageSize={classesQuery.data?.pageSize ?? pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Form Dialog */}
      {canManage && <>
        <ClassFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialData={editingClass}
          onSubmit={handleSubmitForm}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />

        <ReasonDialog
          dialog={{ open: Boolean(statusTarget), onOpenChange: handleStatusDialogChange }}
          content={{
            title: statusTarget ? `${statusTarget.actionName} Kelas` : 'Ubah Status Kelas',
            description: statusTarget ? `Masukkan alasan untuk ${statusTarget.actionName} kelas ${statusTarget.item.nama_kelas}.` : '',
          }}
          action={{
            confirmLabel: statusTarget?.nextStatus ? 'Aktifkan Kelas' : 'Nonaktifkan Kelas',
            onConfirm: handleConfirmStatus,
          }}
          reason={{
            label: 'Alasan Perubahan *',
            placeholder: 'Contoh: Kelas tidak lagi digunakan pada tahun ajaran ini...',
          }}
          destructive={statusTarget ? !statusTarget.nextStatus : false}
        />
      </>}
    </div>
  );
}
