import { lazy, Suspense, useState } from 'react';
import { CalendarCheck } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { Pagination } from '@/shared/ui/Pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useClassOptionsQuery } from '@/features/classes/hooks/useClassOptionsQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { hasCapability } from '@/shared/auth/capabilities';
import { isOneOf } from '@/shared/utils/isOneOf';

import { useAttendanceQuery, useAttendanceSummaryQuery } from '../hooks/useAttendanceQuery';
import { useRecordAttendanceMutation } from '../hooks/useRecordAttendanceMutation';
import { useCorrectAttendanceMutation } from '../hooks/useCorrectAttendanceMutation';

import { AttendanceSummaryCards } from '../components/AttendanceSummaryCards';
import { AttendanceFilter } from '../components/AttendanceFilter';
import { AttendanceTable } from '../components/AttendanceTable';
import { AttendanceMobileList } from '../components/AttendanceMobileList';
import { AttendanceQueryError } from '../components/AttendanceQueryError';

import { ATTENDANCE_STATUS_VALUES } from '../types/attendance.types';
import type { AttendanceRecord, RecordAttendanceItem } from '../types/attendance.types';
import type { CorrectAttendanceFormValues } from '../schemas/attendanceSchema';

const LazyAttendanceStudentReport = lazy(() => import('../components/AttendanceStudentReport').then(({ AttendanceStudentReport }) => ({ default: AttendanceStudentReport })));
const LazyRecordAttendanceModal = lazy(() => import('../components/RecordAttendanceModal').then(({ RecordAttendanceModal }) => ({ default: RecordAttendanceModal })));
const LazyCorrectAttendanceModal = lazy(() => import('../components/CorrectAttendanceModal').then(({ CorrectAttendanceModal }) => ({ default: CorrectAttendanceModal })));

export function AttendancePage() {
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const canCorrect = hasCapability(user, 'attendance.correct');
  const canRecord = hasCapability(user, 'attendance.record');
  const canReadStudents = hasCapability(user, 'students.read');
  const isOwn = hasCapability(user, 'attendance.read.own') && !hasCapability(user, 'attendance.read');
  const [view, setView] = useState<'daily' | 'student_report'>('daily');

  // Filters
  const [tanggal, setTanggal] = useState(isOwn ? '' : new Date().toISOString().split('T')[0]);
  const [kelas, setKelas] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [status, setStatus] = useState<string>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = UI_CONSTANTS.DEFAULT_PAGE_SIZE;

  const debouncedSearch = useDebouncedValue(search, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);
  const statusFilter = isOneOf(status, ATTENDANCE_STATUS_VALUES) ? status : undefined;

  const handleTanggalChange = (val: string) => {
    setTanggal(val);
    setPage(1);
  };

  const handleKelasChange = (val: string) => {
    setKelas(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleResetFilter = () => {
    setTanggal(isOwn ? '' : new Date().toISOString().split('T')[0]);
    setKelas(UI_CONSTANTS.ALL_FILTER_VALUE);
    setStatus(UI_CONSTANTS.ALL_FILTER_VALUE);
    setSearch('');
    setPage(1);
  };

  // Modals
  const [recordOpen, setRecordOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctRecord, setCorrectRecord] = useState<AttendanceRecord | null>(null);

  // Queries
  const summaryQuery = useAttendanceSummaryQuery({
    tanggal: tanggal || undefined,
    kelas: kelas !== UI_CONSTANTS.ALL_FILTER_VALUE ? kelas : undefined,
    status: statusFilter,
    search: debouncedSearch || undefined,
    scope: isOwn ? 'own' : undefined,
  }, view === 'daily');
  const attendanceQuery = useAttendanceQuery({
    page,
    pageSize,
    tanggal,
    kelas: kelas !== UI_CONSTANTS.ALL_FILTER_VALUE ? kelas : undefined,
    status: statusFilter,
    search: debouncedSearch || undefined,
    scope: isOwn ? 'own' : undefined,
  }, view === 'daily');
  const classOptionsQuery = useClassOptionsQuery(canRecord && recordOpen);
  const { data: classOptions = [] } = classOptionsQuery;

  const [hasVisitedStudentReport, setHasVisitedStudentReport] = useState(false);

  // Mutations
  const recordMutation = useRecordAttendanceMutation();
  const correctMutation = useCorrectAttendanceMutation();

  // Handlers
  const handleOpenCorrect = (rec: AttendanceRecord) => {
    setCorrectRecord(rec);
    setCorrectOpen(true);
  };

  const handleViewChange = (nextView: string) => {
    if (nextView !== 'daily' && nextView !== 'student_report') return;
    if (nextView === 'student_report') setHasVisitedStudentReport(true);
    setView(nextView);
  };

  const handleRecordSubmit = async (values: {
    tanggal: string;
    kelas: string;
    records: RecordAttendanceItem[];
  }) => {
    await recordMutation.mutateAsync({
      payload: {
        tanggal: values.tanggal,
        kelas: values.kelas,
        records: values.records,
      },
    });
  };

  const handleCorrectSubmit = async (values: CorrectAttendanceFormValues) => {
    if (!correctRecord) return;
    await correctMutation.mutateAsync({
      payload: {
        attendance_id: correctRecord.id,
        status: values.status,
        keterangan: values.keterangan || undefined,
      },
      changeReason: values.change_reason,
    });
  };

  const dailySummaryContent = (() => {
    if (summaryQuery.isPending) return <PageLoader />;
    if (summaryQuery.isError) {
      return (
        <AttendanceQueryError
          error={summaryQuery.error}
          title="Ringkasan absensi belum dapat dimuat"
          onRetry={summaryQuery.refetch}
        />
      );
    }
    return <AttendanceSummaryCards summary={summaryQuery.data} isOwn={isOwn} totalLabel={tanggal ? undefined : 'catatan'} />;
  })();

  const dailyAttendanceContent = (() => {
    if (attendanceQuery.isPending) return <PageLoader />;
    if (attendanceQuery.isError) {
      return (
        <AttendanceQueryError
          error={attendanceQuery.error}
          title="Data absensi belum dapat dimuat"
          onRetry={attendanceQuery.refetch}
        />
      );
    }

    const records = attendanceQuery.data?.data ?? [];
    const list = isMobile
      ? <AttendanceMobileList records={records} onCorrect={handleOpenCorrect} isTeacher={canCorrect} />
      : <AttendanceTable records={records} onCorrect={handleOpenCorrect} isTeacher={canCorrect} />;

    return (
      <div className="space-y-4">
        {list}
        <Pagination
          page={attendanceQuery.data?.page ?? page}
          totalPages={attendanceQuery.data?.totalPages ?? 1}
          total={attendanceQuery.data?.total ?? 0}
          pageSize={attendanceQuery.data?.pageSize ?? pageSize}
          onPageChange={setPage}
        />
      </div>
    );
  })();

  const dailyContent = (
    <>
      {dailySummaryContent}

      <AttendanceFilter
        filters={{ tanggal, kelas, status, search }}
        actions={{
          onTanggalChange: handleTanggalChange,
          onKelasChange: handleKelasChange,
          onStatusChange: handleStatusChange,
          onSearchChange: handleSearchChange,
          onReset: handleResetFilter,
        }}
        scope={{ isOwn }}
      />

      {dailyAttendanceContent}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <PageHeader
        title={isOwn ? 'Absensi Saya' : 'Absensi Siswa Sinematografi'}
        subtitle={isOwn ? 'Riwayat kehadiran pribadi Anda.' : 'Pencatatan harian kehadiran siswa, ringkasan metrics, dan koreksi otomatis kunci 48 jam.'}
        actions={
          canRecord ? (
            <ResponsivePageActions
              actions={[{
                id: 'record-attendance',
                label: 'Input Absensi Massal',
                icon: CalendarCheck,
                onSelect: () => setRecordOpen(true),
                className: 'bg-semantic-success text-white hover:bg-semantic-success/80',
              }]}
            />
          ) : undefined
        }
      />

      {!isOwn && canReadStudents ? (
        <Tabs value={view} onValueChange={handleViewChange} className="w-full">
          <TabsList className="w-full max-w-xl">
            <TabsTrigger value="daily">Absensi harian</TabsTrigger>
            <TabsTrigger value="student_report">Rekap siswa</TabsTrigger>
          </TabsList>
          <TabsContent value="daily" keepMounted className="mt-5 space-y-5 sm:mt-6">
            {dailyContent}
          </TabsContent>
          <TabsContent value="student_report" keepMounted={hasVisitedStudentReport} className="mt-5 sm:mt-6">
            <Suspense fallback={<PageLoader />}>
              <LazyAttendanceStudentReport canReadStudents={canReadStudents} isActive={view === 'student_report'} />
            </Suspense>
          </TabsContent>
        </Tabs>
      ) : (
        dailyContent
      )}

      {/* Modals */}
      {canRecord && recordOpen && (
        <Suspense fallback={null}>
          <LazyRecordAttendanceModal
            open={recordOpen}
            onOpenChange={setRecordOpen}
            classes={classOptions}
            onSubmit={handleRecordSubmit}
            isLoading={recordMutation.isPending}
            error={recordMutation.error}
            classOptionsError={classOptionsQuery.error}
          />
        </Suspense>
      )}

      {canCorrect && correctOpen && correctRecord && (
        <Suspense fallback={null}>
          <LazyCorrectAttendanceModal
            open={correctOpen}
            onOpenChange={setCorrectOpen}
            record={correctRecord}
            onSubmit={handleCorrectSubmit}
            isLoading={correctMutation.isPending}
            error={correctMutation.error}
          />
        </Suspense>
      )}
    </div>
  );
}
