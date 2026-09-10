// src/features/attendance/pages/AttendancePage.tsx
// Thin orchestration page for Attendance Management

import { useState } from 'react';
import { CalendarCheck } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { ResponsivePageActions } from '@/shared/ui/ResponsivePageActions';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { Pagination } from '@/shared/ui/Pagination';

import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useClassOptionsQuery } from '@/features/classes/hooks/useClassOptionsQuery';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
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
import { AttendanceStudentReport } from '../components/AttendanceStudentReport';
import { RecordAttendanceModal } from '../components/RecordAttendanceModal';
import { CorrectAttendanceModal } from '../components/CorrectAttendanceModal';

import { ATTENDANCE_STATUS_VALUES } from '../types/attendance.types';
import type { AttendanceRecord, RecordAttendanceItem } from '../types/attendance.types';
import type { CorrectAttendanceFormValues } from '../schemas/attendanceSchema';

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
  const [kelas, setKelas] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const debouncedSearch = useDebouncedValue(search, 300);

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
    setKelas('all');
    setStatus('all');
    setSearch('');
    setPage(1);
  };

  // Modals
  const [recordOpen, setRecordOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctRecord, setCorrectRecord] = useState<AttendanceRecord | null>(null);

  // Queries
  const { data: summaryData, isLoading: isSummaryLoading } = useAttendanceSummaryQuery({
    tanggal: tanggal || undefined,
    scope: isOwn ? 'own' : undefined,
  }, view === 'daily');
  const { data: attendanceData, isLoading: isAttendanceLoading } = useAttendanceQuery({
    page,
    pageSize,
    tanggal,
    kelas: kelas !== 'all' ? kelas : undefined,
    status: isOneOf(status, ATTENDANCE_STATUS_VALUES) ? status : undefined,
    search: debouncedSearch || undefined,
    scope: isOwn ? 'own' : undefined,
  }, view === 'daily');
  const { data: classOptions = [] } = useClassOptionsQuery(canRecord);

  // Mutations
  const recordMutation = useRecordAttendanceMutation();
  const correctMutation = useCorrectAttendanceMutation();

  // Handlers
  const handleOpenCorrect = (rec: AttendanceRecord) => {
    setCorrectRecord(rec);
    setCorrectOpen(true);
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

      {!isOwn && canReadStudents && (
        <div className="flex w-full max-w-xl rounded-xl border border-hairline bg-surface-2 p-1" role="tablist" aria-label="Mode absensi">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'daily'}
            onClick={() => setView('daily')}
            className={`min-h-11 flex-1 rounded-lg px-3 text-xs font-medium transition-colors ${view === 'daily' ? 'bg-surface-1 text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'}`}
          >
            Absensi harian
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'student_report'}
            onClick={() => setView('student_report')}
            className={`min-h-11 flex-1 rounded-lg px-3 text-xs font-medium transition-colors ${view === 'student_report' ? 'bg-surface-1 text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'}`}
          >
            Rekap siswa
          </button>
        </div>
      )}

      {view === 'student_report' && !isOwn ? (
        <AttendanceStudentReport canReadStudents={canReadStudents} />
      ) : (
        <>
          {/* Summary Cards */}
          {isSummaryLoading ? <PageLoader /> : <AttendanceSummaryCards summary={summaryData} isOwn={isOwn} totalLabel={tanggal ? undefined : 'catatan'} />}

          {/* Filter */}
          <AttendanceFilter
            tanggal={tanggal}
            onTanggalChange={handleTanggalChange}
            kelas={kelas}
            onKelasChange={handleKelasChange}
            status={status}
            onStatusChange={handleStatusChange}
            search={search}
            onSearchChange={handleSearchChange}
            onReset={handleResetFilter}
            isOwn={isOwn}
          />

          {/* Table */}
          {isAttendanceLoading ? (
            <PageLoader />
          ) : (
            <div className="space-y-4">
              {isMobile ? (
                <AttendanceMobileList records={attendanceData?.data ?? []} onCorrect={handleOpenCorrect} isTeacher={canCorrect} />
              ) : (
                <AttendanceTable records={attendanceData?.data ?? []} onCorrect={handleOpenCorrect} isTeacher={canCorrect} />
              )}
              <Pagination
                page={attendanceData?.page ?? page}
                totalPages={attendanceData?.totalPages ?? 1}
                total={attendanceData?.total ?? 0}
                pageSize={attendanceData?.pageSize ?? pageSize}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {canRecord && (
        <RecordAttendanceModal
          open={recordOpen}
          onOpenChange={setRecordOpen}
          classes={classOptions}
          onSubmit={handleRecordSubmit}
          isLoading={recordMutation.isPending}
          error={recordMutation.error}
        />
      )}

      {canCorrect && correctRecord && (
        <CorrectAttendanceModal
          open={correctOpen}
          onOpenChange={setCorrectOpen}
          record={correctRecord}
          onSubmit={handleCorrectSubmit}
          isLoading={correctMutation.isPending}
          error={correctMutation.error}
        />
      )}
    </div>
  );
}
