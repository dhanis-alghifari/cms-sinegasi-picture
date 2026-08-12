// src/features/grades/pages/GradesPage.tsx
// Thin orchestration page for Student Grades & Universal Grading Management

import { useState } from 'react';
import { ClipboardList, GraduationCap, PlusCircle } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { ResponsivePageActions } from '@/components/common/ResponsivePageActions';
import { PageLoader } from '@/components/common/LoadingSpinner';
import { Pagination } from '@/components/common/Pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useStudentsQuery } from '@/features/students/queries/useStudentsQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';

import { useGradesQuery, useAssignmentsQuery } from '../queries/useGradesQuery';
import { useCreateAssignmentMutation } from '../mutations/useCreateAssignmentMutation';
import { useBulkGradingMutation } from '../mutations/useBulkGradingMutation';

import { GradeDistributionStats } from '../components/GradeDistributionStats';
import { AssignmentFilter } from '../components/AssignmentFilter';
import { AssignmentList } from '../components/AssignmentList';
import { GradeFilter } from '../components/GradeFilter';
import { GradeTable } from '../components/GradeTable';
import { GradeMobileList } from '../components/GradeMobileList';
import { CreateAssignmentModal } from '../components/CreateAssignmentModal';
import { BulkGradingModal } from '../components/BulkGradingModal';

import type { AssignmentCategory, BulkGradeItem } from '../types/grades.types';
import type { CreateAssignmentFormValues } from '../schemas/gradeSchema';

export function GradesPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManageGrades = hasCapability(user, 'grades.manage');

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [kelas, setKelas] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentCategory, setAssignmentCategory] = useState('all');
  const [assignmentKelas, setAssignmentKelas] = useState('all');
  const [assignmentPage, setAssignmentPage] = useState(1);
  const assignmentPageSize = 10;

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedAssignmentSearch = useDebouncedValue(assignmentSearch, 300);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setPage(1);
  };

  const handleKelasChange = (val: string) => {
    setKelas(val);
    setPage(1);
  };

  const handleResetFilter = () => {
    setSearch('');
    setCategory('all');
    setKelas('all');
    setPage(1);
  };

  const handleAssignmentSearchChange = (value: string) => {
    setAssignmentSearch(value);
    setAssignmentPage(1);
  };

  const handleAssignmentCategoryChange = (value: string) => {
    setAssignmentCategory(value);
    setAssignmentPage(1);
  };

  const handleAssignmentKelasChange = (value: string) => {
    setAssignmentKelas(value);
    setAssignmentPage(1);
  };

  const handleAssignmentFilterReset = () => {
    setAssignmentSearch('');
    setAssignmentCategory('all');
    setAssignmentKelas('all');
    setAssignmentPage(1);
  };

  // Modals
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Queries
  const { data: gradesData, isLoading: isGradesLoading } = useGradesQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    category: category !== 'all' ? (category as AssignmentCategory) : undefined,
    kelas: kelas !== 'all' ? kelas : undefined,
    student_id: canManageGrades ? undefined : user?.studentId,
  });

  const {
    data: assignmentsData,
    isLoading: isAssignmentsLoading,
    error: assignmentsError,
  } = useAssignmentsQuery({
    page: assignmentPage,
    pageSize: assignmentPageSize,
    search: debouncedAssignmentSearch || undefined,
    category: assignmentCategory !== 'all' ? (assignmentCategory as AssignmentCategory) : undefined,
    kelas: assignmentKelas !== 'all' ? assignmentKelas : undefined,
  });
  const { data: assignmentOptionsData } = useAssignmentsQuery({ page: 1, pageSize: 1000 }, canManageGrades);
  const { data: studentsData } = useStudentsQuery({ is_active: true }, canManageGrades);

  // Mutations
  const createAssignmentMutation = useCreateAssignmentMutation();
  const bulkGradingMutation = useBulkGradingMutation();

  // Handlers
  const handleCreateAssignmentSubmit = async (values: CreateAssignmentFormValues) => {
    await createAssignmentMutation.mutateAsync({
      payload: {
        title: values.title,
        category: values.category,
        description: values.description || undefined,
        kelas: values.kelas || undefined,
        date: values.date,
      },
    });
  };

  const handleBulkGradingSubmit = async (values: {
    assignment_id: string;
    grades: BulkGradeItem[];
    change_reason: string;
  }) => {
    await bulkGradingMutation.mutateAsync({
      payload: {
        assignment_id: values.assignment_id,
        grades: values.grades,
      },
      changeReason: values.change_reason,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title="Evaluasi & Nilai Universal (A–E)"
        subtitle="Sistem penilaian Universal Grading A-E untuk tugas kelas, karya crew film, dan kegiatan eksternal."
        actions={
          canManageGrades ? (
            <ResponsivePageActions
              mobileLabel="Tindakan Nilai"
              mobileDescription="Pilih aktivitas penilaian yang ingin dilakukan."
              actions={[
                {
                  id: 'create-assignment',
                  label: 'Buat Tugas',
                  description: 'Tambahkan tugas atau aktivitas penilaian baru.',
                  icon: PlusCircle,
                  variant: 'outline',
                  className: 'bg-surface-1 text-ink-subtle hover:text-ink',
                  onSelect: () => setAssignmentOpen(true),
                },
                {
                  id: 'bulk-grade',
                  label: 'Input Penilaian Massal',
                  description: 'Masukkan nilai beberapa siswa sekaligus.',
                  icon: GraduationCap,
                  onSelect: () => setBulkOpen(true),
                },
              ]}
            />
          ) : undefined
        }
      />

      <Tabs defaultValue="grades" className="w-full">
        <TabsList aria-label="Menu nilai" className="grid min-h-12 w-full grid-cols-2 gap-2 border border-hairline bg-surface-2 p-2 md:flex md:min-h-9 md:w-fit md:gap-2 md:p-1">
          <TabsTrigger value="grades" className="min-h-12 min-w-0 flex-1 gap-1.5 px-2 text-xs leading-tight md:min-h-9 md:min-w-44 md:flex-none md:whitespace-nowrap md:px-3">
            <GraduationCap size={14} />
            <span className="md:hidden">Nilai</span>
            <span className="hidden md:inline">Rekap Nilai Siswa</span>
          </TabsTrigger>
          <TabsTrigger value="assignments" className="min-h-12 min-w-0 flex-1 gap-1.5 px-2 text-xs leading-tight md:min-h-9 md:min-w-44 md:flex-none md:whitespace-nowrap md:px-3">
            <ClipboardList size={14} />
            <span className="md:hidden">Tugas</span>
            <span className="hidden md:inline">Daftar Tugas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grades" className="space-y-6 pt-2">
          <GradeDistributionStats grades={gradesData?.data ?? []} />

          <GradeFilter
            search={search}
            onSearchChange={handleSearchChange}
            category={category}
            onCategoryChange={handleCategoryChange}
            kelas={kelas}
            onKelasChange={handleKelasChange}
            onReset={handleResetFilter}
          />

          {isGradesLoading ? (
            <PageLoader />
          ) : (
            <div className="space-y-4">
              {isMobile ? <GradeMobileList grades={gradesData?.data ?? []} /> : <GradeTable grades={gradesData?.data ?? []} />}
              <Pagination
                page={gradesData?.page ?? page}
                totalPages={gradesData?.totalPages ?? 1}
                total={gradesData?.total ?? 0}
                pageSize={gradesData?.pageSize ?? pageSize}
                onPageChange={setPage}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="pt-2">
          <AssignmentFilter
            search={assignmentSearch}
            onSearchChange={handleAssignmentSearchChange}
            category={assignmentCategory}
            onCategoryChange={handleAssignmentCategoryChange}
            kelas={assignmentKelas}
            onKelasChange={handleAssignmentKelasChange}
            onReset={handleAssignmentFilterReset}
          />
          <AssignmentList
            assignments={assignmentsData?.data ?? []}
            isLoading={isAssignmentsLoading}
            error={assignmentsError}
            page={assignmentsData?.page ?? assignmentPage}
            totalPages={assignmentsData?.totalPages ?? 1}
            total={assignmentsData?.total ?? 0}
            pageSize={assignmentsData?.pageSize ?? assignmentPageSize}
            onPageChange={setAssignmentPage}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {canManageGrades && (
        <>
          <CreateAssignmentModal
            open={assignmentOpen}
            onOpenChange={setAssignmentOpen}
            onSubmit={handleCreateAssignmentSubmit}
            isLoading={createAssignmentMutation.isPending}
            error={createAssignmentMutation.error}
          />

          <BulkGradingModal
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            assignments={assignmentOptionsData?.data ?? []}
            students={studentsData?.data ?? []}
            onSubmit={handleBulkGradingSubmit}
            isLoading={bulkGradingMutation.isPending}
            error={bulkGradingMutation.error}
          />
        </>
      )}
    </div>
  );
}
