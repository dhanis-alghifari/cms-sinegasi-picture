
import { lazy, Suspense, useState } from 'react';
import { PackagePlus } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { Pagination } from '@/shared/ui/Pagination';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useStudentsQuery } from '@/features/students/hooks/useStudentsQuery';
import { useEquipmentQuery } from '@/features/equipment/hooks/useEquipmentQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';
import { isOneOf } from '@/shared/utils/isOneOf';

import { useBorrowingQuery, useBorrowingSummaryQuery } from '../hooks/useBorrowingQuery';
import { useCreateBorrowingMutation } from '../hooks/useCreateBorrowingMutation';
import { useApproveRejectBorrowingMutation } from '../hooks/useApproveRejectBorrowingMutation';
import { useHandoverBorrowingMutation } from '../hooks/useHandoverBorrowingMutation';
import { useReturnBorrowingMutation } from '../hooks/useReturnBorrowingMutation';

import { BorrowingSummaryCards } from '../components/BorrowingSummaryCards';
import { BorrowingFilter } from '../components/BorrowingFilter';
import { BorrowingTable } from '../components/BorrowingTable';
import { BorrowingMobileList } from '../components/BorrowingMobileList';

import { BORROWING_STATUS_VALUES } from '../types/borrowing.types';
import type { BorrowingRecord, ReturnItemCondition } from '../types/borrowing.types';
import type { CreateBorrowingFormValues, ApproveRejectFormValues } from '../schemas/borrowingSchema';

const LazyApproveRejectModal = lazy(() =>
  import('../components/ApproveRejectModal').then(({ ApproveRejectModal }) => ({ default: ApproveRejectModal })),
);
const LazyConfirmDialog = lazy(() =>
  import('@/shared/ui/ActionDialog').then(({ ConfirmDialog }) => ({ default: ConfirmDialog })),
);

const LazyCreateBorrowingModal = lazy(() =>
  import('../components/CreateBorrowingModal').then(({ CreateBorrowingModal }) => ({ default: CreateBorrowingModal })),
);
const LazyProcessReturnModal = lazy(() =>
  import('../components/ProcessReturnModal').then(({ ProcessReturnModal }) => ({ default: ProcessReturnModal })),
);

export function BorrowingPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'borrowing.manage');
  const canApprove = canManage;
  const canHandoverOrReturn = canManage;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);
  const pageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;

  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleResetFilter = () => {
    setSearch('');
    setStatus(UI_CONSTANTS.ALL_FILTER_VALUE);
    setPage(1);
  };

  const [createOpen, setCreateOpen] = useState(false);
  const shouldLoadCreateFormOptions = canManage && createOpen;

  const [approveRejectOpen, setApproveRejectOpen] = useState(false);
  const [approveRejectRecord, setApproveRejectRecord] = useState<BorrowingRecord | null>(null);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnRecord, setReturnRecord] = useState<BorrowingRecord | null>(null);
  const [handoverTarget, setHandoverTarget] = useState<BorrowingRecord | null>(null);

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    error: summaryError,
    refetch: refetchSummary,
  } = useBorrowingSummaryQuery();
  const {
    data: borrowingData,
    isLoading: isBorrowingLoading,
    isError: isBorrowingError,
    error: borrowingError,
    refetch: refetchBorrowing,
  } = useBorrowingQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: isOneOf(status, BORROWING_STATUS_VALUES) ? status : undefined,
    borrower_id: user?.role === 'member' ? user.studentId : undefined,
  });

  const {
    data: studentsData,
    isLoading: isStudentsLoading,
    isError: isStudentsError,
    error: studentsError,
    refetch: refetchStudents,
  } = useStudentsQuery(
    { is_active: true, page: 1, pageSize: UI_CONSTANTS.ATTENDANCE_ROSTER_PAGE_SIZE },
    shouldLoadCreateFormOptions,
  );
  const {
    data: equipmentData,
    isLoading: isEquipmentOptionsLoading,
    isError: isEquipmentOptionsError,
    error: equipmentOptionsError,
    refetch: refetchEquipmentOptions,
  } = useEquipmentQuery(
    { status: 'tersedia', page: 1, pageSize: UI_CONSTANTS.ATTENDANCE_ROSTER_PAGE_SIZE },
    shouldLoadCreateFormOptions,
  );

  const createMutation = useCreateBorrowingMutation();
  const approveRejectMutation = useApproveRejectBorrowingMutation();
  const handoverMutation = useHandoverBorrowingMutation();
  const returnMutation = useReturnBorrowingMutation();

  const handleOpenApproveReject = (rec: BorrowingRecord) => {
    setApproveRejectRecord(rec);
    setApproveRejectOpen(true);
  };

  const handleHandover = (rec: BorrowingRecord) => {
    setHandoverTarget(rec);
  };

  const handleConfirmHandover = async () => {
    if (!handoverTarget) return;

    await handoverMutation.mutateAsync({
      id: handoverTarget.id,
      changeReason: 'Penyerahan barang fisik kepada peminjam oleh Tim Alat',
    });
  };

  const handleHandoverDialogChange = (open: boolean) => {
    if (!open) {
      setHandoverTarget(null);
    }
  };

  const handleOpenReturn = (rec: BorrowingRecord) => {
    setReturnRecord(rec);
    setReturnOpen(true);
  };

  const handleCreateSubmit = async (values: CreateBorrowingFormValues) => {
    const { ...payload } = values;
    await createMutation.mutateAsync({
      payload: {
        ...payload,
        idempotency_key: crypto.randomUUID(),
      },
    });
  };

  const handleApproveRejectSubmit = async (values: ApproveRejectFormValues) => {
    if (!approveRejectRecord) return;
    await approveRejectMutation.mutateAsync({
      payload: {
        borrowing_id: approveRejectRecord.id,
        action: values.action,
        catatan: values.catatan || undefined,
      },
      changeReason: values.change_reason,
    });
  };

  const handleReturnSubmit = async (values: {
    borrowing_id: string;
    tanggal_dikembalikan: string;
    item_conditions: ReturnItemCondition[];
    catatan_pengembalian?: string;
    change_reason: string;
  }) => {
    await returnMutation.mutateAsync({
      payload: {
        borrowing_id: values.borrowing_id,
        tanggal_dikembalikan: values.tanggal_dikembalikan,
        item_conditions: values.item_conditions,
        catatan_pengembalian: values.catatan_pengembalian,
      },
      changeReason: values.change_reason,
    });
  };

  const summaryContent = (() => {
    if (isSummaryLoading) return <PageLoader label="Memuat ringkasan peminjaman..." />;
    if (isSummaryError) {
      return <QueryErrorState title="Ringkasan peminjaman belum dapat dimuat" error={summaryError} onRetry={refetchSummary} />;
    }
    return <BorrowingSummaryCards summary={summaryData} />;
  })();

  const borrowingContent = (() => {
    if (isBorrowingLoading) return <PageLoader label="Memuat daftar peminjaman..." />;
    if (isBorrowingError) {
      return <QueryErrorState title="Daftar peminjaman belum dapat dimuat" error={borrowingError} onRetry={refetchBorrowing} />;
    }

    const borrowings = borrowingData?.data ?? [];
    const list = isMobile
      ? <BorrowingMobileList borrowings={borrowings} onApproveReject={handleOpenApproveReject} onHandover={handleHandover} onReturn={handleOpenReturn} canManage={canManage} canApprove={canApprove} canHandoverOrReturn={canHandoverOrReturn} />
      : <BorrowingTable borrowings={borrowings} onApproveReject={handleOpenApproveReject} onHandover={handleHandover} onReturn={handleOpenReturn} canManage={canManage} canApprove={canApprove} canHandoverOrReturn={canHandoverOrReturn} />;

    return (
      <div className="space-y-4">
        {list}
        <Pagination
          page={borrowingData?.page ?? page}
          totalPages={borrowingData?.totalPages ?? 1}
          total={borrowingData?.total ?? 0}
          pageSize={borrowingData?.pageSize ?? pageSize}
          onPageChange={setPage}
        />
      </div>
    );
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Transaksi Peminjaman &amp; Pengembalian Alat"
        subtitle="Alur persetujuan peminjaman, penyerahan barang, pemeriksaan fisik pengembalian, serta tagihan perbaikan dan penggantian."
        actions={
          <ResponsivePageActions
            actions={[{
              id: 'create-borrowing',
              label: 'Ajukan Peminjaman Alat',
              icon: PackagePlus,
              onSelect: () => setCreateOpen(true),
            }]}
          />
        }
      />

      {summaryContent}

      <BorrowingFilter
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        onReset={handleResetFilter}
      />

      {borrowingContent}

      {canManage && createOpen && (
        <Suspense fallback={null}>
          <LazyCreateBorrowingModal
            dialog={{ open: createOpen, onOpenChange: setCreateOpen }}
            options={{
              students: studentsData?.data ?? [],
              studentsLoading: isStudentsLoading,
              studentsError: isStudentsError ? studentsError : undefined,
              equipmentList: equipmentData?.data ?? [],
              equipmentLoading: isEquipmentOptionsLoading,
              equipmentError: isEquipmentOptionsError ? equipmentOptionsError : undefined,
            }}
            submission={{ onSubmit: handleCreateSubmit, isLoading: createMutation.isPending, error: createMutation.error }}
            actions={{ onRetryStudents: refetchStudents, onRetryEquipment: refetchEquipmentOptions }}
          />
        </Suspense>
      )}

      {canManage && (
        <Suspense fallback={null}>
          {approveRejectOpen && approveRejectRecord && (
            <LazyApproveRejectModal
              open
              onOpenChange={setApproveRejectOpen}
              record={approveRejectRecord}
              onSubmit={handleApproveRejectSubmit}
              isLoading={approveRejectMutation.isPending}
              error={approveRejectMutation.error}
            />
          )}

          {returnOpen && (
            <Suspense fallback={null}>
              <LazyProcessReturnModal
                key={returnRecord?.id ?? 'return-modal'}
                open={returnOpen}
                onOpenChange={setReturnOpen}
                record={returnRecord}
                onSubmit={handleReturnSubmit}
                isLoading={returnMutation.isPending}
                error={returnMutation.error}
              />
            </Suspense>
          )}

          {canHandoverOrReturn && handoverTarget && (
            <LazyConfirmDialog
              dialog={{ open: true, onOpenChange: handleHandoverDialogChange }}
              content={{
                title: 'Serahkan Alat',
                description: handoverTarget
                  ? `Serahkan barang untuk peminjaman atas nama ${handoverTarget.borrower_nama}? Status alat akan berubah menjadi sedang dipinjam.`
                  : '',
              }}
              action={{ confirmLabel: 'Serahkan Alat', onConfirm: handleConfirmHandover }}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
