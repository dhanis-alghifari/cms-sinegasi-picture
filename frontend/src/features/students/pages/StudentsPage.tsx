
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { DataTableSkeleton, RefreshingIndicator } from '@/shared/ui/LoadingSkeletons';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { Pagination } from '@/shared/ui/Pagination';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { UI_CONSTANTS } from '@/shared/constants/ui';

import { useStudentsQuery } from '../hooks/useStudentsQuery';
import { useCreateStudentMutation } from '../hooks/useCreateStudentMutation';
import { useUpdateStudentMutation } from '../hooks/useUpdateStudentMutation';
import { useProvisionStudentAccountMutation } from '../hooks/useProvisionStudentAccountMutation';
import { useLinkExistingStudentAccountMutation } from '../hooks/useLinkExistingStudentAccountMutation';
import { useLinkAccountToExistingProfileMutation } from '../hooks/useLinkAccountToExistingProfileMutation';
import { useDeleteStudentMutation } from '../hooks/useDeleteStudentMutation';
import { StudentFilter } from '../components/StudentFilter';
import { StudentTable } from '../components/StudentTable';
import { StudentMobileList } from '../components/StudentMobileList';
import { PEMINATAN_VALUES } from '../types/students.types';
import type { Student, StudentAccountResponse } from '../types/students.types';
import type { StudentAccountSubmission } from '../components/StudentFormDialog';
import type { StudentProvisionAccountInput } from '../components/StudentProvisionAccountDialog';
import { isOneOf } from '@/shared/utils/isOneOf';
import type { StudentFormValues } from '../schemas/studentSchema';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';
import { getErrorMessage } from '@/shared/api/errors';
import { toast } from '@/shared/ui/primitives/toast';
import { studentsService } from '../api/students.service';

const LazyStudentDetailSheet = lazy(() =>
  import('../components/StudentDetailSheet').then(({ StudentDetailSheet }) => ({ default: StudentDetailSheet })),
);
const LazyStudentFormDialog = lazy(() =>
  import('../components/StudentFormDialog').then(({ StudentFormDialog }) => ({ default: StudentFormDialog })),
);
const LazyStudentStatusDialog = lazy(() =>
  import('../components/StudentStatusDialog').then(({ StudentStatusDialog }) => ({ default: StudentStatusDialog })),
);
const LazyStudentAccountCredentialsDialog = lazy(() =>
  import('../components/StudentAccountCredentialsDialog').then(({ StudentAccountCredentialsDialog }) => ({
    default: StudentAccountCredentialsDialog,
  })),
);
const LazyLinkLegacyAccountDialog = lazy(() =>
  import('../components/LinkLegacyAccountDialog').then(({ LinkLegacyAccountDialog }) => ({ default: LinkLegacyAccountDialog })),
);
const LazyStudentProvisionAccountDialog = lazy(() =>
  import('../components/StudentProvisionAccountDialog').then(({ StudentProvisionAccountDialog }) => ({ default: StudentProvisionAccountDialog })),
);
const LazyReasonDialog = lazy(() =>
  import('@/shared/ui/ActionDialog').then(({ ReasonDialog }) => ({ default: ReasonDialog })),
);

export function StudentsPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'students.manage');
  const canManageStatus = hasCapability(user, 'users.manage');

  // Filter state
  const [search, setSearch] = useState('');
  const [kelas, setKelas] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [peminatan, setPeminatan] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);
  const pageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;

  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);

  // Reset page when filters change
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleKelasChange = (val: string) => {
    setKelas(val);
    setPage(1);
  };

  const handlePeminatanChange = (val: string) => {
    setPeminatan(val);
    setPage(1);
  };

  const handleResetFilter = () => {
    setSearch('');
    setKelas(UI_CONSTANTS.ALL_FILTER_VALUE);
    setPeminatan(UI_CONSTANTS.ALL_FILTER_VALUE);
    setPage(1);
  };

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTargetStudent, setStatusTargetStudent] = useState<Student | null>(null);
  const [provisionTargetStudent, setProvisionTargetStudent] = useState<Student | null>(null);
  const [pendingCredentials, setPendingCredentials] = useState<StudentAccountResponse | null>(null);
  const issuedAccount = useRef<StudentAccountResponse | null>(null);
  const editLoadSequence = useRef(0);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [linkTargetStudent, setLinkTargetStudent] = useState<Student | null>(null);
  const [purgeTargetStudent, setPurgeTargetStudent] = useState<Student | null>(null);

  const handleAccountIssued = useCallback((response: StudentAccountResponse) => {
    if (response.account.temporary_password || !issuedAccount.current) {
      issuedAccount.current = response;
    }
  }, []);

  const credentialsToShow = !dialogOpen && !provisionTargetStudent ? pendingCredentials : null;

  // Queries & Mutations
  const { data, isLoading, isFetching, isError, error, refetch } = useStudentsQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    kelas: kelas !== UI_CONSTANTS.ALL_FILTER_VALUE ? kelas : undefined,
    peminatan: isOneOf(peminatan, PEMINATAN_VALUES) ? peminatan : undefined,
  });

  const createMutation = useCreateStudentMutation(handleAccountIssued);
  const updateMutation = useUpdateStudentMutation();
  const provisionMutation = useProvisionStudentAccountMutation(handleAccountIssued);
  const linkNewProfileMutation = useLinkExistingStudentAccountMutation();
  const linkExistingProfileMutation = useLinkAccountToExistingProfileMutation();
  const deleteMutation = useDeleteStudentMutation();

  const handleOpenAdd = () => {
    editLoadSequence.current += 1;
    createMutation.reset();
    updateMutation.reset();
    linkNewProfileMutation.reset();
    setSelectedStudent(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = async (student: Student) => {
    const sequence = ++editLoadSequence.current;
    createMutation.reset();
    updateMutation.reset();
    linkNewProfileMutation.reset();
    try {
      const completeStudent = await studentsService.getStudentById(student.id);
      if (sequence !== editLoadSequence.current) return;
      setSelectedStudent(completeStudent);
      setDialogOpen(true);
    } catch (error) {
      if (sequence === editLoadSequence.current) {
        toast.add({ type: 'error', title: 'Data siswa gagal dimuat', description: getErrorMessage(error) });
      }
    }
  };

  const handleOpenStatusDialog = (student: Student) => {
    updateMutation.reset();
    setStatusTargetStudent(student);
    setStatusDialogOpen(true);
  };

  const handleOpenProvisionDialog = (student: Student) => {
    provisionMutation.reset();
    setProvisionTargetStudent(student);
  };

  const handleProvisionDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (issuedAccount.current) setPendingCredentials(issuedAccount.current);
      setProvisionTargetStudent(null);
    }
  };

  const handleStudentDialogOpenChange = (open: boolean) => {
    if (!open && issuedAccount.current) setPendingCredentials(issuedAccount.current);
    setDialogOpen(open);
  };

  const handleOpenLinkDialog = (student: Student) => {
    linkExistingProfileMutation.reset();
    setLinkTargetStudent(student);
  };

  const handleOpenPurgeDialog = (student: Student) => {
    deleteMutation.reset();
    setDetailStudent(null);
    setPurgeTargetStudent(student);
  };

  const handlePurgeSubmit = async (reason: string) => {
    if (!purgeTargetStudent) return;
    await deleteMutation.mutateAsync({ id: purgeTargetStudent.id, changeReason: reason });
    setPurgeTargetStudent(null);
  };

  const handleLinkExistingProfile = async (userId: string, changeReason: string) => {
    if (!linkTargetStudent) return;
    await linkExistingProfileMutation.mutateAsync({
      studentId: linkTargetStudent.id,
      userId,
      changeReason,
    });
    setLinkTargetStudent(null);
  };

  const handleProvisionSubmit = async (input: StudentProvisionAccountInput) => {
    if (!provisionTargetStudent) return;
    await provisionMutation.mutateAsync({
      id: provisionTargetStudent.id,
      username: input.username,
      phoneNumber: input.phoneNumber,
      changeReason: input.changeReason,
      idempotencyKey: input.idempotencyKey,
    });
    if (issuedAccount.current) setPendingCredentials(issuedAccount.current);
    setProvisionTargetStudent(null);
  };

  const handleStatusSubmit = async (reason: string) => {
    if (!statusTargetStudent) return;
    await updateMutation.mutateAsync({
      id: statusTargetStudent.id,
      payload: { is_active: !statusTargetStudent.is_active },
      changeReason: reason,
    });
  };

  const handleFormSubmit = async (values: StudentFormValues, account: StudentAccountSubmission) => {
    const profilePayload = {
      nis: values.nis,
      nama: values.nama,
      kelas: values.kelas,
      peminatan: values.peminatan,
      no_telepon: values.no_telepon,
      foto_url: values.foto_url,
    };

    if (selectedStudent) {
      await updateMutation.mutateAsync({
        id: selectedStudent.id,
        payload: profilePayload,
        changeReason: values.change_reason ?? '',
      });
    } else {
      if (account.mode === 'existing') {
        await linkNewProfileMutation.mutateAsync({
          ...profilePayload,
          user_id: account.userId,
          change_reason: values.change_reason,
        });
      } else {
        await createMutation.mutateAsync({
          payload: {
            ...profilePayload,
            username: values.username ?? '',
            role: values.role ?? 'member',
            change_reason: 'Membuat data siswa dan akun login baru',
          },
          idempotencyKey: account.mode === 'new' ? account.operationKey : '',
        });
        if (issuedAccount.current) setPendingCredentials(issuedAccount.current);
      }
      // Reset filter & page so newly added student immediately appears at the top of the table
      setSearch('');
      setKelas(UI_CONSTANTS.ALL_FILTER_VALUE);
      setPeminatan(UI_CONSTANTS.ALL_FILTER_VALUE);
      setPage(1);
    }
  };

  const studentContent = (() => {
    if (isLoading) return <DataTableSkeleton columns={6} rows={6} mobile={isMobile} label="Memuat daftar siswa..." />;
    if (isError && !data) {
      return <QueryErrorState title="Daftar siswa belum dapat dimuat" error={error} onRetry={refetch} />;
    }

    const students = data?.data ?? [];
    const list = isMobile
      ? <StudentMobileList students={students} onOpenDetail={setDetailStudent} onEdit={handleOpenEdit} onToggleActive={handleOpenStatusDialog} onDelete={handleOpenPurgeDialog} onProvisionAccount={handleOpenProvisionDialog} onLinkLegacyAccount={handleOpenLinkDialog} canManage={canManage} canManageStatus={canManageStatus} />
      : <StudentTable students={students} onEdit={handleOpenEdit} onToggleActive={handleOpenStatusDialog} onDelete={handleOpenPurgeDialog} onProvisionAccount={handleOpenProvisionDialog} onLinkLegacyAccount={handleOpenLinkDialog} canManage={canManage} canManageStatus={canManageStatus} />;

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

  return (
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Manajemen Data Siswa"
        subtitle="Kelola profil, kelas, peminatan, dan status keaktifan siswa sinematografi."
        actions={
          canManage ? (
            <ResponsivePageActions
              actions={[{
                id: 'add-student',
                label: 'Tambah Siswa',
                icon: Plus,
                onSelect: handleOpenAdd,
              }]}
            />
          ) : undefined
        }
      />

      <StudentFilter
        search={search}
        onSearchChange={handleSearchChange}
        kelas={kelas}
        onKelasChange={handleKelasChange}
        peminatan={peminatan}
        onPeminatanChange={handlePeminatanChange}
        onReset={handleResetFilter}
      />

      <RefreshingIndicator visible={isFetching && !isLoading} />
      {studentContent}

      {canManage && (
        <Suspense fallback={null}>
          {detailStudent && (
            <LazyStudentDetailSheet
              dialog={{
                open: true,
                onOpenChange: (open) => { if (!open) setDetailStudent(null); },
              }}
              student={detailStudent}
              viewport={{ isMobile }}
              permissions={{ canManage, canManageStatus }}
              actions={{
                onEdit: handleOpenEdit,
                onToggleActive: handleOpenStatusDialog,
                onDelete: handleOpenPurgeDialog,
                onProvisionAccount: handleOpenProvisionDialog,
                onLinkLegacyAccount: handleOpenLinkDialog,
              }}
            />
          )}
          {dialogOpen && (
            <LazyStudentFormDialog
              key={selectedStudent?.id ?? 'new-student'}
              open
              onOpenChange={handleStudentDialogOpenChange}
              student={selectedStudent}
              canLinkExistingAccount={canManageStatus}
              onSubmit={handleFormSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending || linkNewProfileMutation.isPending}
              error={createMutation.error || updateMutation.error || linkNewProfileMutation.error}
            />
          )}
          {statusDialogOpen && (
            <LazyStudentStatusDialog
              open
              onOpenChange={setStatusDialogOpen}
              student={statusTargetStudent}
              onSubmit={handleStatusSubmit}
              isLoading={updateMutation.isPending}
              error={updateMutation.error}
            />
          )}
          {provisionTargetStudent && (
            <LazyStudentProvisionAccountDialog
              key={provisionTargetStudent.id}
              open
              student={provisionTargetStudent}
              onOpenChange={handleProvisionDialogOpenChange}
              onSubmit={handleProvisionSubmit}
              isLoading={provisionMutation.isPending}
              error={provisionMutation.error}
            />
          )}
          {linkTargetStudent && (
            <LazyLinkLegacyAccountDialog
              open
              onOpenChange={(open) => { if (!open) setLinkTargetStudent(null); }}
              student={linkTargetStudent}
              onSubmit={handleLinkExistingProfile}
              isLoading={linkExistingProfileMutation.isPending}
              error={linkExistingProfileMutation.error}
            />
          )}
          {purgeTargetStudent && (
            <LazyReasonDialog
              dialog={{
                open: true,
                onOpenChange: (open) => { if (!open) setPurgeTargetStudent(null); },
              }}
              content={{
                title: 'Hapus data siswa permanen',
                description: `Data ${purgeTargetStudent.nama} yang sudah nonaktif akan dihapus permanen, termasuk absensi, tunggakan, dan tagihan billing. Transaksi kas yang benar-benar sudah masuk atau keluar tetap dipertahankan agar saldo dan cashflow tidak berubah.`,
              }}
              action={{ confirmLabel: 'Hapus permanen', onConfirm: handlePurgeSubmit }}
              reason={{ label: 'Alasan penghapusan *', placeholder: 'Contoh: akun tes dan data siswa sudah tidak aktif' }}
              destructive
            />
          )}
          {credentialsToShow && (
            <LazyStudentAccountCredentialsDialog
              open
              onOpenChange={(open) => {
                if (!open) {
                  setPendingCredentials(null);
                  issuedAccount.current = null;
                }
              }}
              studentName={credentialsToShow.data.nama}
              credentials={{ ...credentialsToShow.account, whatsapp_number: credentialsToShow.data.no_telepon }}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
