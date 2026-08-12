// src/features/equipment/pages/EquipmentPage.tsx
// Thin orchestration page for Equipment Catalog & Inventory Management

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { ResponsivePageActions } from '@/components/common/ResponsivePageActions';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';

import { useEquipmentQuery, useEquipmentSummaryQuery } from '../queries/useEquipmentQuery';
import { useCreateEquipmentMutation } from '../mutations/useCreateEquipmentMutation';
import { useUpdateEquipmentMutation } from '../mutations/useUpdateEquipmentMutation';
import { useUpdateConditionMutation } from '../mutations/useUpdateConditionMutation';

import { EquipmentSummaryStats } from '../components/EquipmentSummaryStats';
import { EquipmentFilter } from '../components/EquipmentFilter';
import { EquipmentTable } from '../components/EquipmentTable';
import { EquipmentMobileList } from '../components/EquipmentMobileList';
import { EquipmentFormDialog } from '../components/EquipmentFormDialog';
import { UpdateConditionDialog } from '../components/UpdateConditionDialog';

import type {
  Equipment,
  EquipmentCategory,
  EquipmentCondition,
  EquipmentAvailability,
} from '../types/equipment.types';
import type { EquipmentFormValues, UpdateConditionFormValues } from '../schemas/equipmentSchema';

export function EquipmentPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'equipment.manage');

  // Filters
  const [search, setSearch] = useState('');
  const [kategori, setKategori] = useState('all');
  const [kondisi, setKondisi] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const debouncedSearch = useDebouncedValue(search, 300);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleKategoriChange = (val: string) => {
    setKategori(val);
    setPage(1);
  };

  const handleKondisiChange = (val: string) => {
    setKondisi(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleResetFilter = () => {
    setSearch('');
    setKategori('all');
    setKondisi('all');
    setStatus('all');
    setPage(1);
  };

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  const [conditionOpen, setConditionOpen] = useState(false);
  const [conditionTarget, setConditionTarget] = useState<Equipment | null>(null);

  // Queries
  const { data: summaryData, isLoading: isSummaryLoading } = useEquipmentSummaryQuery();
  const { data: equipmentData, isLoading: isEquipmentLoading } = useEquipmentQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    kategori: kategori !== 'all' ? (kategori as EquipmentCategory) : undefined,
    kondisi: kondisi !== 'all' ? (kondisi as EquipmentCondition) : undefined,
    status: status !== 'all' ? (status as EquipmentAvailability) : undefined,
  });

  // Mutations
  const createMutation = useCreateEquipmentMutation();
  const updateMutation = useUpdateEquipmentMutation();
  const conditionMutation = useUpdateConditionMutation();

  // Handlers
  const handleOpenAdd = () => {
    createMutation.reset();
    updateMutation.reset();
    setSelectedEquipment(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (eq: Equipment) => {
    createMutation.reset();
    updateMutation.reset();
    setSelectedEquipment(eq);
    setFormOpen(true);
  };

  const handleOpenCondition = (eq: Equipment) => {
    conditionMutation.reset();
    setConditionTarget(eq);
    setConditionOpen(true);
  };

  const handleFormSubmit = async (values: EquipmentFormValues) => {
    const { change_reason, ...payload } = values;

    if (selectedEquipment) {
      await updateMutation.mutateAsync({
        id: selectedEquipment.id,
        payload,
        changeReason: change_reason ?? '',
      });
    } else {
      await createMutation.mutateAsync({
        payload,
      });
      // A newly created item must be visible even when the previous filter excluded it.
      handleResetFilter();
    }
  };

  const handleConditionSubmit = async (values: UpdateConditionFormValues) => {
    if (!conditionTarget) return;
    await conditionMutation.mutateAsync({
      id: conditionTarget.id,
      payload: {
        kondisi: values.kondisi,
        status: values.status,
        catatan_kerusakan: values.catatan_kerusakan || undefined,
      },
      changeReason: values.change_reason,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Katalog & Inventaris Alat Sinematografi"
        subtitle="Kelola data kamera, lensa, audio, lighting, status ketersediaan, dan laporan maintenance fisik."
        actions={
          canManage ? (
            <ResponsivePageActions
              actions={[{
                id: 'add-equipment',
                label: 'Tambah Alat Baru',
                icon: Plus,
                onSelect: handleOpenAdd,
              }]}
            />
          ) : undefined
        }
      />

      {/* Summary Cards */}
      {isSummaryLoading ? <PageLoader /> : <EquipmentSummaryStats summary={summaryData} />}

      {/* Filter */}
      <EquipmentFilter
        search={search}
        onSearchChange={handleSearchChange}
        kategori={kategori}
        onKategoriChange={handleKategoriChange}
        kondisi={kondisi}
        onKondisiChange={handleKondisiChange}
        status={status}
        onStatusChange={handleStatusChange}
        onReset={handleResetFilter}
      />

      {/* Table */}
      {isEquipmentLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          {isMobile ? (
            <EquipmentMobileList
              equipment={equipmentData?.data ?? []}
              onEdit={handleOpenEdit}
              onUpdateCondition={handleOpenCondition}
              canManage={canManage}
            />
          ) : (
            <EquipmentTable
              equipment={equipmentData?.data ?? []}
              onEdit={handleOpenEdit}
              onUpdateCondition={handleOpenCondition}
              canManage={canManage}
            />
          )}
          <Pagination
            page={equipmentData?.page ?? page}
            totalPages={equipmentData?.totalPages ?? 1}
            total={equipmentData?.total ?? 0}
            pageSize={equipmentData?.pageSize ?? pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modals */}
      {canManage && (
        <>
          <EquipmentFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            equipment={selectedEquipment}
            onSubmit={handleFormSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
            error={createMutation.error || updateMutation.error}
          />

          <UpdateConditionDialog
            open={conditionOpen}
            onOpenChange={setConditionOpen}
            equipment={conditionTarget}
            onSubmit={handleConditionSubmit}
            isLoading={conditionMutation.isPending}
            error={conditionMutation.error}
          />
        </>
      )}
    </div>
  );
}
