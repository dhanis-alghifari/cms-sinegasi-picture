// src/features/classes/pages/ClassesPage.tsx

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Layers, Edit2, Power } from 'lucide-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
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
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { ReasonDialog } from '@/shared/ui/ActionDialog';
import { classesService } from '../api/classes.service';
import { ClassFormDialog } from '../components/ClassFormDialog';
import { ClassMobileList } from '../components/ClassMobileList';
import type { ClassOption } from '../types/classes.types';
import { AuditHistoryButton } from '@/features/audit/components/AuditHistoryButton';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { hasCapability } from '@/shared/auth/capabilities';

export function ClassesPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'classes.manage');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tingkatFilter, setTingkatFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const debouncedSearch = useDebouncedValue(search, 300);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{
    item: ClassOption;
    nextStatus: boolean;
    actionName: string;
  } | null>(null);

  const loadClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await classesService.getAdminClasses({
        search: debouncedSearch || undefined,
        tingkat: tingkatFilter !== 'all' ? tingkatFilter : undefined,
        page,
        pageSize,
      });
      setClasses(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch {
      setClasses([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, tingkatFilter, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadClasses(), 0);
    return () => window.clearTimeout(timer);
  }, [loadClasses]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleTingkatChange = (val: string) => {
    setTingkatFilter(val);
    setPage(1);
  };

  const handleOpenAdd = () => {
    setEditingClass(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: ClassOption) => {
    setEditingClass(item);
    setDialogOpen(true);
  };

  const handleToggleStatus = (item: ClassOption) => {
    const nextStatus = !item.is_active;
    const actionName = nextStatus ? 'mengaktifkan' : 'menonaktifkan';
    setStatusTarget({ item, nextStatus, actionName });
  };

  const handleConfirmStatus = async (reason: string) => {
    if (!statusTarget) return;

    await classesService.updateClass(statusTarget.item.id, {
      is_active: statusTarget.nextStatus,
      change_reason: reason,
    });
    await loadClasses();
  };

  const handleStatusDialogChange = (open: boolean) => {
    if (!open) {
      setStatusTarget(null);
    }
  };

  const handleSubmitForm = async (values: { nama_kelas: string; tingkat: string; change_reason?: string }) => {
    setIsSubmitting(true);
    try {
      if (editingClass) {
        await classesService.updateClass(editingClass.id, values);
        await loadClasses();
      } else {
        await classesService.createClass({ nama_kelas: values.nama_kelas, tingkat: values.tingkat });
        setSearch('');
        setTingkatFilter('all');
        setPage(1);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <Input
            type="text"
            placeholder="Cari nama kelas (misal: TKJ 1, AK 5)..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-11 bg-surface-1 pl-9 text-xs text-ink placeholder:text-ink-tertiary sm:h-9"
          />
        </div>

        <Select value={tingkatFilter} onValueChange={(val) => val && handleTingkatChange(val)}>
          <SelectTrigger className="h-11 w-full bg-surface-1 text-xs text-ink sm:h-9 sm:w-40">
            <SelectValue placeholder="Tingkat" />
          </SelectTrigger>
          <SelectContent className="bg-surface-3 border-hairline text-ink">
            <SelectItem value="all">Semua Tingkat</SelectItem>
            <SelectItem value="X">Tingkat X</SelectItem>
            <SelectItem value="XI">Tingkat XI</SelectItem>
            <SelectItem value="XII">Tingkat XII</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Classes Table */}
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          {isMobile ? <ClassMobileList classes={classes} onEdit={handleOpenEdit} onToggleStatus={handleToggleStatus} canManage={canManage} /> : <div className="overflow-hidden rounded-lg border border-hairline bg-surface-1">
            <Table>
              <TableHeader className="bg-surface-2/60">
                <TableRow className="border-hairline">
                  <TableHead className="text-ink-subtle text-xs font-semibold">Nama Kelas</TableHead>
                  <TableHead className="text-ink-subtle text-xs font-semibold">Tingkat</TableHead>
                  <TableHead className="text-ink-subtle text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
                  {canManage && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.length === 0 ? (
                  <TableRow className="border-hairline">
                    <TableCell colSpan={canManage ? 5 : 4} className="py-8 text-center text-ink-tertiary">
                      <Layers className="mx-auto h-8 w-8 text-ink-tertiary mb-2 opacity-50" />
                      Tidak ada kelas yang ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  classes.map((cls) => (
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
                      <TableCell className="text-right"><AuditHistoryButton tableName="classes" recordId={cls.id} /></TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>}

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
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
          isLoading={isSubmitting}
        />

        <ReasonDialog
          open={Boolean(statusTarget)}
          onOpenChange={handleStatusDialogChange}
          title={statusTarget ? `${statusTarget.actionName} Kelas` : 'Ubah Status Kelas'}
          description={statusTarget ? `Masukkan alasan untuk ${statusTarget.actionName} kelas ${statusTarget.item.nama_kelas}.` : ''}
          reasonLabel="Alasan Perubahan *"
          reasonPlaceholder="Contoh: Kelas tidak lagi digunakan pada tahun ajaran ini..."
          confirmLabel={statusTarget?.nextStatus ? 'Aktifkan Kelas' : 'Nonaktifkan Kelas'}
          destructive={statusTarget ? !statusTarget.nextStatus : false}
          onConfirm={handleConfirmStatus}
        />
      </>}
    </div>
  );
}
