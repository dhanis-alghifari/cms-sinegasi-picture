
import { lazy, Suspense, useState } from 'react';
import { FileDown, Plus, Tags } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { Pagination } from '@/shared/ui/Pagination';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';
import { isOneOf } from '@/shared/utils/isOneOf';

import { useEquipmentQuery, useEquipmentSummaryQuery } from '../hooks/useEquipmentQuery';
import { useCreateEquipmentMutation } from '../hooks/useCreateEquipmentMutation';
import { useUpdateEquipmentMutation } from '../hooks/useUpdateEquipmentMutation';
import { useUpdateConditionMutation } from '../hooks/useUpdateConditionMutation';

import { EquipmentSummaryStats } from '../components/EquipmentSummaryStats';
import { EquipmentFilter } from '../components/EquipmentFilter';
import { EquipmentTable } from '../components/EquipmentTable';
import { EquipmentMobileList } from '../components/EquipmentMobileList';
import { useCreateEquipmentValuationMutation } from '../hooks/useEquipmentValuation';
import { useCompleteEquipmentRepairMutation, useCreateEquipmentRecoveryMutation, useEquipmentRecoveryQuery, useRegisterEquipmentReplacementMutation } from '../hooks/useEquipmentRecovery';

import type {
  Equipment,
} from '../types/equipment.types';
import {
  EQUIPMENT_AVAILABILITY_VALUES,
  EQUIPMENT_CATEGORY_VALUES,
  EQUIPMENT_CONDITION_VALUES,
} from '../types/equipment.types';
import type { EquipmentFormValues, UpdateConditionFormValues } from '../schemas/equipmentSchema';
import type { EquipmentRecoveryCase } from '../types/equipment.types';

const EquipmentReportDialog = lazy(() => import('../components/EquipmentReportDialog').then((module) => ({ default: module.EquipmentReportDialog })));
const EquipmentAttentionTabs = lazy(() => import('../components/EquipmentAttentionTabs').then((module) => ({ default: module.EquipmentAttentionTabs })));
const EquipmentFormDialog = lazy(() => import('../components/EquipmentFormDialog').then((module) => ({ default: module.EquipmentFormDialog })));
const UpdateConditionDialog = lazy(() => import('../components/UpdateConditionDialog').then((module) => ({ default: module.UpdateConditionDialog })));
const EquipmentValuationDialog = lazy(() => import('../components/EquipmentValuationDialog').then((module) => ({ default: module.EquipmentValuationDialog })));
const EquipmentRecoveryDialog = lazy(() => import('../components/EquipmentRecoveryDialog').then((module) => ({ default: module.EquipmentRecoveryDialog })));

export function EquipmentPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'equipment.manage');
  const canRead = hasCapability(user, 'equipment.read');

  const [search, setSearch] = useState('');
  const [kategori, setKategori] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [kondisi, setKondisi] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [status, setStatus] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);
  const pageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;

  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);

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
    setKategori(UI_CONSTANTS.ALL_FILTER_VALUE);
    setKondisi(UI_CONSTANTS.ALL_FILTER_VALUE);
    setStatus(UI_CONSTANTS.ALL_FILTER_VALUE);
    setPage(1);
  };

  const [formOpen, setFormOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  const [conditionOpen, setConditionOpen] = useState(false);
  const [conditionTarget, setConditionTarget] = useState<Equipment | null>(null);
  const [valuationOpen, setValuationOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<'create' | 'repair' | 'replacement'>('create');
  const [recoveryTarget, setRecoveryTarget] = useState<Equipment | null>(null);
  const [selectedRecoveryCase, setSelectedRecoveryCase] = useState<EquipmentRecoveryCase | null>(null);
  const [recoveryInstance, setRecoveryInstance] = useState(0);

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    error: summaryError,
    refetch: refetchSummary,
  } = useEquipmentSummaryQuery();
  const {
    data: equipmentData,
    isLoading: isEquipmentLoading,
    isError: isEquipmentError,
    error: equipmentError,
    refetch: refetchEquipment,
  } = useEquipmentQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    kategori: isOneOf(kategori, EQUIPMENT_CATEGORY_VALUES) ? kategori : undefined,
    kondisi: isOneOf(kondisi, EQUIPMENT_CONDITION_VALUES) ? kondisi : undefined,
    status: isOneOf(status, EQUIPMENT_AVAILABILITY_VALUES) ? status : undefined,
  });

  const createMutation = useCreateEquipmentMutation();
  const updateMutation = useUpdateEquipmentMutation();
  const conditionMutation = useUpdateConditionMutation();
  const valuationMutation = useCreateEquipmentValuationMutation();
  const recoveryQuery = useEquipmentRecoveryQuery(canRead);
  const createRecoveryMutation = useCreateEquipmentRecoveryMutation();
  const completeRepairMutation = useCompleteEquipmentRepairMutation();
  const registerReplacementMutation = useRegisterEquipmentReplacementMutation();

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

  const handleOpenRecoveryCreate = (eq: Equipment) => {
    setRecoveryTarget(eq); setSelectedRecoveryCase(null); setRecoveryMode('create'); createRecoveryMutation.reset(); setRecoveryInstance((value) => value + 1); setRecoveryOpen(true);
  };
  const handleOpenRecoveryRepair = (recoveryCase: EquipmentRecoveryCase, eq?: Equipment) => {
    setRecoveryTarget(eq || null); setSelectedRecoveryCase(recoveryCase); setRecoveryMode('repair'); completeRepairMutation.reset(); setRecoveryInstance((value) => value + 1); setRecoveryOpen(true);
  };
  const handleOpenRecoveryReplacement = (recoveryCase: EquipmentRecoveryCase, eq?: Equipment) => {
    setRecoveryTarget(eq || null); setSelectedRecoveryCase(recoveryCase); setRecoveryMode('replacement'); registerReplacementMutation.reset(); setRecoveryInstance((value) => value + 1); setRecoveryOpen(true);
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

  const pageActions = (() => {
    if (!canRead) return undefined;

    const managementActions = canManage ? [{
      id: 'add-equipment',
      label: 'Tambah Alat Baru',
      icon: Plus,
      onSelect: handleOpenAdd,
    }, {
      id: 'manage-valuations',
      label: 'Kelola Nilai Penggantian',
      icon: Tags,
      onSelect: () => { valuationMutation.reset(); setValuationOpen(true); },
    }] : [];

    return (
      <ResponsivePageActions
        actions={[
          {
            id: 'equipment-report',
            label: 'Laporan Alat',
            icon: FileDown,
            onSelect: () => setReportOpen(true),
          },
          ...managementActions,
        ]}
      />
    );
  })();

  return (
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Katalog & Inventaris Alat Sinematografi"
        subtitle="Kelola data kamera, lensa, audio, lighting, status ketersediaan, dan laporan maintenance fisik."
        actions={pageActions}
      />

      {canRead && (
        <Suspense fallback={<div className="min-h-24 rounded-xl border border-hairline bg-surface-1" aria-hidden="true" />}>
          <EquipmentAttentionTabs
            data={{
              equipment: equipmentData?.data ?? [],
              cases: recoveryQuery.data ?? [],
              recoveryLoading: recoveryQuery.isLoading,
              recoveryError: recoveryQuery.error,
            }}
            actions={{
              onRetryRecovery: recoveryQuery.refetch,
              onOpenCreate: handleOpenRecoveryCreate,
              onOpenRepair: handleOpenRecoveryRepair,
              onOpenReplacement: handleOpenRecoveryReplacement,
            }}
            permissions={{ canManage }}
          />
        </Suspense>
      )}

      {isSummaryLoading && (
        <PageLoader label="Memuat ringkasan alat..." />
      )}
      {isSummaryError && (
        <QueryErrorState
          title="Ringkasan alat belum dapat dimuat"
          error={summaryError}
          onRetry={refetchSummary}
        />
      )}
      {!isSummaryLoading && !isSummaryError && (
        <EquipmentSummaryStats summary={summaryData} />
      )}

      <EquipmentFilter
        filters={{ search, kategori, kondisi, status }}
        actions={{
          onSearchChange: handleSearchChange,
          onKategoriChange: handleKategoriChange,
          onKondisiChange: handleKondisiChange,
          onStatusChange: handleStatusChange,
          onReset: handleResetFilter,
        }}
      />

      {isEquipmentLoading && (
        <PageLoader label="Memuat daftar alat..." />
      )}
      {isEquipmentError && (
        <QueryErrorState
          title="Daftar alat belum dapat dimuat"
          error={equipmentError}
          onRetry={refetchEquipment}
        />
      )}
      {!isEquipmentLoading && !isEquipmentError && (
        <div className="space-y-4">
          {isMobile ? (
            <EquipmentMobileList
              equipment={equipmentData?.data ?? []}
              onEdit={handleOpenEdit}
              onUpdateCondition={handleOpenCondition}
              onOpenRecovery={handleOpenRecoveryCreate}
              canManage={canManage}
            />
          ) : (
            <EquipmentTable
              equipment={equipmentData?.data ?? []}
              onEdit={handleOpenEdit}
              onUpdateCondition={handleOpenCondition}
              onOpenRecovery={handleOpenRecoveryCreate}
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

      {canManage && (
        <>
          {formOpen && <Suspense fallback={null}><EquipmentFormDialog
            open
            onOpenChange={setFormOpen}
            equipment={selectedEquipment}
            onSubmit={handleFormSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
            error={createMutation.error || updateMutation.error}
          /></Suspense>}

          {conditionOpen && <Suspense fallback={null}><UpdateConditionDialog
            open
            onOpenChange={setConditionOpen}
            equipment={conditionTarget}
            onSubmit={handleConditionSubmit}
            isLoading={conditionMutation.isPending}
            error={conditionMutation.error}
          /></Suspense>}
          {valuationOpen && <Suspense fallback={null}><EquipmentValuationDialog
            open
            onOpenChange={setValuationOpen}
            equipment={equipmentData?.data ?? []}
            onSubmit={async (equipmentId, payload, changeReason) => {
              await valuationMutation.mutateAsync({ id: equipmentId, payload, changeReason });
            }}
            isLoading={valuationMutation.isPending}
            error={valuationMutation.error}
          /></Suspense>}
          {recoveryOpen && <Suspense fallback={null}><EquipmentRecoveryDialog
            key={`recovery-${recoveryInstance}`}
            dialog={{
              open: true,
              onOpenChange: (open) => { setRecoveryOpen(open); if (!open) { setRecoveryTarget(null); setSelectedRecoveryCase(null); } },
            }}
            context={{ mode: recoveryMode, equipment: recoveryTarget, recoveryCase: selectedRecoveryCase }}
            submission={{
              isLoading: createRecoveryMutation.isPending || completeRepairMutation.isPending || registerReplacementMutation.isPending,
              error: createRecoveryMutation.error || completeRepairMutation.error || registerReplacementMutation.error,
              onCreate: async (payload) => { if (!recoveryTarget) return; await createRecoveryMutation.mutateAsync({ equipmentId: recoveryTarget.id, payload }); },
              onCompleteRepair: async (payload) => { await completeRepairMutation.mutateAsync(payload); },
              onRegisterReplacement: async (payload) => { await registerReplacementMutation.mutateAsync(payload); },
            }}
          /></Suspense>}
        </>
      )}
      {canRead && reportOpen && (
        <Suspense fallback={null}>
          <EquipmentReportDialog
            open
            onOpenChange={setReportOpen}
            search={debouncedSearch || undefined}
            kategori={isOneOf(kategori, EQUIPMENT_CATEGORY_VALUES) ? kategori : undefined}
            kondisi={isOneOf(kondisi, EQUIPMENT_CONDITION_VALUES) ? kondisi : undefined}
            status={isOneOf(status, EQUIPMENT_AVAILABILITY_VALUES) ? status : undefined}
          />
        </Suspense>
      )}
    </div>
  );
}
