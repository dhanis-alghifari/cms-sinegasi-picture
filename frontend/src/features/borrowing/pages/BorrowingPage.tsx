// src/features/borrowing/pages/BorrowingPage.tsx
// Thin orchestration page for Borrowing & Return Management

import { useState } from 'react';
import { PackagePlus } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { ResponsivePageActions } from '@/components/common/ResponsivePageActions';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import { ConfirmDialog } from '@/components/common/ActionDialog';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useStudentsQuery } from '@/features/students/queries/useStudentsQuery';
import { useEquipmentQuery } from '@/features/equipment/queries/useEquipmentQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';

import { useBorrowingQuery, useBorrowingSummaryQuery } from '../queries/useBorrowingQuery';
import { useCreateBorrowingMutation } from '../mutations/useCreateBorrowingMutation';
import { useApproveRejectBorrowingMutation } from '../mutations/useApproveRejectBorrowingMutation';
import { useHandoverBorrowingMutation } from '../mutations/useHandoverBorrowingMutation';
import { useReturnBorrowingMutation } from '../mutations/useReturnBorrowingMutation';

import { BorrowingSummaryCards } from '../components/BorrowingSummaryCards';
import { BorrowingFilter } from '../components/BorrowingFilter';
import { BorrowingTable } from '../components/BorrowingTable';
import { BorrowingMobileList } from '../components/BorrowingMobileList';
import { CreateBorrowingModal } from '../components/CreateBorrowingModal';
import { ApproveRejectModal } from '../components/ApproveRejectModal';
import { ProcessReturnModal } from '../components/ProcessReturnModal';

import type { BorrowingRecord, BorrowingStatus, ReturnItemCondition } from '../types/borrowing.types';
import type { CreateBorrowingFormValues, ApproveRejectFormValues } from '../schemas/borrowingSchema';

export function BorrowingPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'borrowing.manage');
  const canApprove = canManage;
  const canHandoverOrReturn = canManage;

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const debouncedSearch = useDebouncedValue(search, 300);

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
    setStatus('all');
    setPage(1);
  };

  // Modals
  const [createOpen, setCreateOpen] = useState(false);

  const [approveRejectOpen, setApproveRejectOpen] = useState(false);
  const [approveRejectRecord, setApproveRejectRecord] = useState<BorrowingRecord | null>(null);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnRecord, setReturnRecord] = useState<BorrowingRecord | null>(null);
  const [handoverTarget, setHandoverTarget] = useState<BorrowingRecord | null>(null);

  // Queries
  const { data: summaryData, isLoading: isSummaryLoading } = useBorrowingSummaryQuery();
  const { data: borrowingData, isLoading: isBorrowingLoading } = useBorrowingQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: status !== 'all' ? (status as BorrowingStatus) : undefined,
    borrower_id: user?.role === 'member' ? user.studentId : undefined,
  });

  const { data: studentsData } = useStudentsQuery({ is_active: true, page: 1, pageSize: 100 });
  const { data: equipmentData } = useEquipmentQuery({ status: 'tersedia', page: 1, pageSize: 100 });

  // Mutations
  const createMutation = useCreateBorrowingMutation();
  const approveRejectMutation = useApproveRejectBorrowingMutation();
  const handoverMutation = useHandoverBorrowingMutation();
  const returnMutation = useReturnBorrowingMutation();

  // Handlers
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
    total_denda?: number;
    change_reason: string;
  }) => {
    await returnMutation.mutateAsync({
      payload: {
        borrowing_id: values.borrowing_id,
        tanggal_dikembalikan: values.tanggal_dikembalikan,
        item_conditions: values.item_conditions,
        catatan_pengembalian: values.catatan_pengembalian,
        total_denda: values.total_denda,
      },
      changeReason: values.change_reason,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Transaksi Peminjaman &amp; Pengembalian Alat"
        subtitle="Alur persetujuan peminjaman, penyerahan barang, pemeriksaan fisik pengembalian, dan kalkulasi denda keterlambatan."
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

      {/* Summary Cards */}
      {isSummaryLoading ? <PageLoader /> : <BorrowingSummaryCards summary={summaryData} />}

      {/* Filter */}
      <BorrowingFilter
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        onReset={handleResetFilter}
      />

      {/* Table */}
      {isBorrowingLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          {isMobile ? (
            <BorrowingMobileList
              borrowings={borrowingData?.data ?? []}
              onApproveReject={handleOpenApproveReject}
              onHandover={handleHandover}
              onReturn={handleOpenReturn}
              canManage={canManage}
              canApprove={canApprove}
              canHandoverOrReturn={canHandoverOrReturn}
            />
          ) : (
            <BorrowingTable
              borrowings={borrowingData?.data ?? []}
              onApproveReject={handleOpenApproveReject}
              onHandover={handleHandover}
              onReturn={handleOpenReturn}
              canManage={canManage}
              canApprove={canApprove}
              canHandoverOrReturn={canHandoverOrReturn}
            />
          )}
          <Pagination
            page={borrowingData?.page ?? page}
            totalPages={borrowingData?.totalPages ?? 1}
            total={borrowingData?.total ?? 0}
            pageSize={borrowingData?.pageSize ?? pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modals */}
      {canManage && <CreateBorrowingModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          students={studentsData?.data ?? []}
          equipmentList={equipmentData?.data ?? []}
          onSubmit={handleCreateSubmit}
          isLoading={createMutation.isPending}
          error={createMutation.error}
        />}

      {canManage && (
        <>
          <ApproveRejectModal
            open={approveRejectOpen}
            onOpenChange={setApproveRejectOpen}
            record={approveRejectRecord}
            onSubmit={handleApproveRejectSubmit}
            isLoading={approveRejectMutation.isPending}
            error={approveRejectMutation.error}
          />

          <ProcessReturnModal
            open={returnOpen}
            onOpenChange={setReturnOpen}
            record={returnRecord}
            onSubmit={handleReturnSubmit}
            isLoading={returnMutation.isPending}
            error={returnMutation.error}
          />

          {canHandoverOrReturn && (
            <ConfirmDialog
              open={Boolean(handoverTarget)}
              onOpenChange={handleHandoverDialogChange}
              title="Serahkan Alat"
              description={handoverTarget
                ? `Serahkan barang untuk peminjaman atas nama ${handoverTarget.borrower_nama}? Status alat akan berubah menjadi sedang dipinjam.`
                : ''}
              confirmLabel="Serahkan Alat"
              onConfirm={handleConfirmHandover}
            />
          )}
        </>
      )}
    </div>
  );
}
