// src/features/students/pages/StudentsPage.tsx
// Thin orchestration page for Students Management

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { Pagination } from '@/shared/ui/Pagination';
import { ReasonDialog } from '@/shared/ui/ActionDialog';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

import { useStudentsQuery } from '../hooks/useStudentsQuery';
import { useCreateStudentMutation } from '../hooks/useCreateStudentMutation';
import { useUpdateStudentMutation } from '../hooks/useUpdateStudentMutation';
import { useProvisionStudentAccountMutation } from '../hooks/useProvisionStudentAccountMutation';
import { StudentFilter } from '../components/StudentFilter';
import { StudentTable } from '../components/StudentTable';
import { StudentMobileList } from '../components/StudentMobileList';
import { StudentDetailSheet } from '../components/StudentDetailSheet';
import { StudentFormDialog } from '../components/StudentFormDialog';
import { StudentStatusDialog } from '../components/StudentStatusDialog';
import { StudentAccountCredentialsDialog } from '../components/StudentAccountCredentialsDialog';
import { PEMINATAN_VALUES } from '../types/students.types';
import type { Student, StudentAccountCredentials } from '../types/students.types';
import { isOneOf } from '@/shared/utils/isOneOf';
import type { StudentFormValues } from '../schemas/studentSchema';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';

export function StudentsPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManage = hasCapability(user, 'students.manage');
  const canManageStatus = hasCapability(user, 'users.manage');

  // Filter state
  const [search, setSearch] = useState('');
  const [kelas, setKelas] = useState('all');
  const [peminatan, setPeminatan] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const debouncedSearch = useDebouncedValue(search, 300);

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
    setKelas('all');
    setPeminatan('all');
    setPage(1);
  };

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTargetStudent, setStatusTargetStudent] = useState<Student | null>(null);
  const [provisionTargetStudent, setProvisionTargetStudent] = useState<Student | null>(null);
  const [credentials, setCredentials] = useState<StudentAccountCredentials | null>(null);
  const [credentialsStudentName, setCredentialsStudentName] = useState<string | undefined>();
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);

  // Queries & Mutations
  const { data, isLoading } = useStudentsQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    kelas: kelas !== 'all' ? kelas : undefined,
    peminatan: isOneOf(peminatan, PEMINATAN_VALUES) ? peminatan : undefined,
  });

  const createMutation = useCreateStudentMutation();
  const updateMutation = useUpdateStudentMutation();
  const provisionMutation = useProvisionStudentAccountMutation();

  const handleOpenAdd = () => {
    createMutation.reset();
    updateMutation.reset();
    setSelectedStudent(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    createMutation.reset();
    updateMutation.reset();
    setSelectedStudent(student);
    setDialogOpen(true);
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

  const handleProvisionSubmit = async (reason: string) => {
    if (!provisionTargetStudent) return;
    const result = await provisionMutation.mutateAsync({ id: provisionTargetStudent.id, changeReason: reason });
    setCredentials(result.account);
    setCredentialsStudentName(provisionTargetStudent.nama);
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

  const handleFormSubmit = async (values: StudentFormValues) => {
    const payload = {
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
        payload,
        changeReason: values.change_reason ?? '',
      });
    } else {
      const result = await createMutation.mutateAsync({
        payload,
      });
      setCredentials(result.account);
      setCredentialsStudentName(values.nama);
      // Reset filter & page so newly added student immediately appears at the top of the table
      setSearch('');
      setKelas('all');
      setPeminatan('all');
      setPage(1);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
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

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          {isMobile ? (
            <StudentMobileList
              students={data?.data ?? []}
              onOpenDetail={setDetailStudent}
              onEdit={handleOpenEdit}
              onToggleActive={handleOpenStatusDialog}
              onProvisionAccount={handleOpenProvisionDialog}
              canManage={canManage}
              canManageStatus={canManageStatus}
            />
          ) : (
            <StudentTable
              students={data?.data ?? []}
              onEdit={handleOpenEdit}
              onToggleActive={handleOpenStatusDialog}
              onProvisionAccount={handleOpenProvisionDialog}
              canManage={canManage}
              canManageStatus={canManageStatus}
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

      {canManage && (
        <>
          <StudentDetailSheet
            open={Boolean(detailStudent)}
            onOpenChange={(open) => { if (!open) setDetailStudent(null); }}
            student={detailStudent}
            isMobile={isMobile}
            onEdit={handleOpenEdit}
            onToggleActive={handleOpenStatusDialog}
            onProvisionAccount={handleOpenProvisionDialog}
            canManage={canManage}
            canManageStatus={canManageStatus}
          />
          <StudentFormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            student={selectedStudent}
            onSubmit={handleFormSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
            error={createMutation.error || updateMutation.error}
          />
          <StudentStatusDialog
            open={statusDialogOpen}
            onOpenChange={setStatusDialogOpen}
            student={statusTargetStudent}
            onSubmit={handleStatusSubmit}
            isLoading={updateMutation.isPending}
            error={updateMutation.error}
          />
          <ReasonDialog
            open={Boolean(provisionTargetStudent)}
            onOpenChange={(open) => { if (!open) setProvisionTargetStudent(null); }}
            title="Buat Akun Anggota Siswa"
            description={provisionTargetStudent
              ? `Buat akun login otomatis untuk ${provisionTargetStudent.nama}? Username akan dibuat dari NIS dan role menjadi Anggota.`
              : ''}
            reasonLabel="Alasan Pembuatan Akun *"
            reasonPlaceholder="Contoh: Melengkapi akun siswa lama"
            confirmLabel="Buat Akun"
            onConfirm={handleProvisionSubmit}
          />
          <StudentAccountCredentialsDialog
            open={Boolean(credentials)}
            onOpenChange={(open) => { if (!open) { setCredentials(null); setCredentialsStudentName(undefined); } }}
            studentName={credentialsStudentName}
            credentials={credentials}
          />
        </>
      )}
    </div>
  );
}
