
import { useState } from 'react';
import { ClipboardList, GraduationCap, PlusCircle } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { Pagination } from '@/shared/ui/Pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useStudentsQuery } from '@/features/students/hooks/useStudentsQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';
import { isOneOf } from '@/shared/utils/isOneOf';

import { useGradesQuery, useAssignmentsQuery, useGradeSummaryQuery } from '../hooks/useGradesQuery';
import { useCreateAssignmentMutation } from '../hooks/useCreateAssignmentMutation';
import { useBulkGradingMutation } from '../hooks/useBulkGradingMutation';

import { GradeDistributionStats } from '../components/GradeDistributionStats';
import { AssignmentFilter } from '../components/AssignmentFilter';
import { AssignmentList } from '../components/AssignmentList';
import { GradeFilter } from '../components/GradeFilter';
import { GradeTable } from '../components/GradeTable';
import { GradeMobileList } from '../components/GradeMobileList';
import { CreateAssignmentModal } from '../components/CreateAssignmentModal';
import { BulkGradingModal } from '../components/BulkGradingModal';

import { ASSIGNMENT_CATEGORY_VALUES } from '../types/grades.types';
import type { BulkGradeItem } from '../types/grades.types';
import type { CreateAssignmentFormValues } from '../schemas/gradeSchema';

export function GradesPage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canManageGrades = hasCapability(user, 'grades.manage');
  const isPersonalView = !hasCapability(user, 'grades.read');
  const gradeScope = isPersonalView ? 'own' : 'operational';

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [kelas, setKelas] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);
  const pageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;

  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentCategory, setAssignmentCategory] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [assignmentKelas, setAssignmentKelas] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const assignmentPageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;

  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);
  const debouncedAssignmentSearch = useDebouncedValue(assignmentSearch, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);

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
    setCategory(UI_CONSTANTS.ALL_FILTER_VALUE);
    setKelas(UI_CONSTANTS.ALL_FILTER_VALUE);
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
    setAssignmentCategory(UI_CONSTANTS.ALL_FILTER_VALUE);
    setAssignmentKelas(UI_CONSTANTS.ALL_FILTER_VALUE);
    setAssignmentPage(1);
  };

  // Modals
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Queries
  const {
    data: gradesData,
    isLoading: isGradesLoading,
    isError: isGradesError,
    error: gradesError,
    refetch: refetchGrades,
  } = useGradesQuery({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    category: isOneOf(category, ASSIGNMENT_CATEGORY_VALUES) ? category : undefined,
    kelas: kelas !== UI_CONSTANTS.ALL_FILTER_VALUE ? kelas : undefined,
    scope: gradeScope,
  });
  const { data: gradeSummary } = useGradeSummaryQuery({
    scope: gradeScope,
    category: isOneOf(category, ASSIGNMENT_CATEGORY_VALUES) ? category : undefined,
  });

  const {
    data: assignmentsData,
    isLoading: isAssignmentsLoading,
    isError: isAssignmentsError,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useAssignmentsQuery({
    page: assignmentPage,
    pageSize: assignmentPageSize,
    search: debouncedAssignmentSearch || undefined,
    category: isOneOf(assignmentCategory, ASSIGNMENT_CATEGORY_VALUES) ? assignmentCategory : undefined,
    kelas: assignmentKelas !== UI_CONSTANTS.ALL_FILTER_VALUE ? assignmentKelas : undefined,
    scope: gradeScope,
  });
  const { data: assignmentOptionsData } = useAssignmentsQuery({ page: 1, pageSize: UI_CONSTANTS.ASSIGNMENT_OPTIONS_LIMIT, scope: 'operational' }, canManageGrades);
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
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title={isPersonalView ? 'Nilai & Tugas Saya' : 'Evaluasi & Nilai Universal (A–E)'}
        subtitle={isPersonalView ? 'Pantau hasil penilaian dan tugas yang ditujukan untuk kelas Anda.' : 'Sistem penilaian Universal Grading A-E untuk tugas kelas, karya crew film, dan kegiatan eksternal.'}
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
        <TabsList aria-label="Menu nilai" className="grid w-full grid-cols-2 md:flex md:w-fit">
          <TabsTrigger value="grades" className="min-w-0 gap-1.5 px-2 text-xs leading-tight md:min-w-44 md:flex-none md:whitespace-nowrap md:px-3">
            <GraduationCap size={14} />
            <span className="md:hidden">Nilai</span>
            <span className="hidden md:inline">{isPersonalView ? 'Riwayat Nilai Saya' : 'Rekap Nilai Siswa'}</span>
          </TabsTrigger>
          <TabsTrigger value="assignments" className="min-w-0 gap-1.5 px-2 text-xs leading-tight md:min-w-44 md:flex-none md:whitespace-nowrap md:px-3">
            <ClipboardList size={14} /><span className="md:hidden">Tugas</span><span className="hidden md:inline">{isPersonalView ? 'Tugas Saya' : 'Daftar Tugas'}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grades" className="space-y-6 pt-2">
          <GradeDistributionStats grades={gradesData?.data ?? []} summary={gradeSummary} isPersonal={isPersonalView} />

          <GradeFilter
            filters={{ search, category, kelas }}
            actions={{
              onSearchChange: handleSearchChange,
              onCategoryChange: handleCategoryChange,
              onKelasChange: handleKelasChange,
              onReset: handleResetFilter,
            }}
            scope={{ isOwn: isPersonalView }}
          />

          {isGradesLoading && (
            <PageLoader label="Memuat rekap nilai..." />
          )}
          {isGradesError && (
            <QueryErrorState
              title="Rekap nilai belum dapat dimuat"
              error={gradesError}
              onRetry={refetchGrades}
            />
          )}
          {!isGradesLoading && !isGradesError && (
            <div className="space-y-4">
              {isMobile ? <GradeMobileList grades={gradesData?.data ?? []} isPersonal={isPersonalView} /> : <GradeTable grades={gradesData?.data ?? []} isPersonal={isPersonalView} />}
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
            filters={{ search: assignmentSearch, category: assignmentCategory, kelas: assignmentKelas }}
            actions={{
              onSearchChange: handleAssignmentSearchChange,
              onCategoryChange: handleAssignmentCategoryChange,
              onKelasChange: handleAssignmentKelasChange,
              onReset: handleAssignmentFilterReset,
            }}
            scope={{ isOwn: isPersonalView }}
          />
          <AssignmentList
            data={{
              assignments: assignmentsData?.data ?? [],
              isLoading: isAssignmentsLoading,
              error: assignmentsError,
              isError: isAssignmentsError,
            }}
            pagination={{
              page: assignmentsData?.page ?? assignmentPage,
              totalPages: assignmentsData?.totalPages ?? 1,
              total: assignmentsData?.total ?? 0,
              pageSize: assignmentsData?.pageSize ?? assignmentPageSize,
              onPageChange: setAssignmentPage,
            }}
            view={{ isOwn: isPersonalView }}
            actions={{ onRetry: refetchAssignments }}
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
