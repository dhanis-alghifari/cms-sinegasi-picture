import { useState } from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import type { ReportPrintFormat } from '@/shared/types/report';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { ReportFormatSelector } from '@/shared/ui/report/ReportFormatSelector';
import { ReportPreviewDialog } from '@/shared/ui/report/ReportPreviewDialog';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { formatNumber } from '@/shared/utils/formatNumber';

import { useStudentOptionsQuery } from '@/features/students/hooks/useStudentOptionsQuery';
import type { StudentOption } from '@/features/students/types/students.types';
import { AttendanceMobileList } from './AttendanceMobileList';
import { AttendanceReportFilter } from './AttendanceReportFilter';
import { AttendanceSummaryCards } from './AttendanceSummaryCards';
import { AttendanceTable } from './AttendanceTable';
import { AttendanceQueryError } from './AttendanceQueryError';
import { useAttendanceQuery, useAttendanceSummaryQuery } from '../hooks/useAttendanceQuery';
import type { AttendanceReportPreset } from '../types/attendance.types';
import { attendanceService } from '../api/attendance.service';
import {
  formatAttendanceReportPeriod,
  getAttendanceReportPresetLabel,
  getAttendanceReportRange,
} from '../utils/attendanceReportDates';
import { exportAttendanceReportCsv } from '../utils/exportAttendanceReportCsv';
import { printAttendanceReport } from '../utils/printAttendanceReport';

interface AttendanceStudentReportProps {
  canReadStudents: boolean;
  isActive?: boolean;
}

export function AttendanceStudentReport({ canReadStudents, isActive = true }: AttendanceStudentReportProps) {
  const isMobile = useIsMobile();
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [preset, setPreset] = useState<AttendanceReportPreset>('this_month');
  const [initialRange] = useState(() => getAttendanceReportRange('this_month'));
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [printFormat, setPrintFormat] = useState<ReportPrintFormat>('a4');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const pageSize = UI_CONSTANTS.ATTENDANCE_REPORT_PAGE_SIZE;

  const studentOptionsQuery = useStudentOptionsQuery(studentSearch, canReadStudents && isActive);
  const studentId = selectedStudent?.id ?? '';
  const rangeError = dateFrom && dateTo && dateFrom > dateTo
    ? 'Tanggal mulai harus sama atau sebelum tanggal selesai.'
    : undefined;
  const reportParams = {
    page,
    pageSize,
    student_id: studentId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };
  const reportEnabled = Boolean(canReadStudents && isActive && studentId && !rangeError);
  const summaryQuery = useAttendanceSummaryQuery({
    student_id: studentId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }, reportEnabled);
  const attendanceQuery = useAttendanceQuery(reportParams, reportEnabled);
  const records = attendanceQuery.data?.data ?? [];
  const periodLabel = preset === 'all_time'
    ? getAttendanceReportPresetLabel(preset)
    : formatAttendanceReportPeriod(dateFrom, dateTo);

  const handlePresetChange = (nextPreset: Exclude<AttendanceReportPreset, 'custom'>) => {
    const nextRange = getAttendanceReportRange(nextPreset);
    setPreset(nextPreset);
    setDateFrom(nextRange.dateFrom);
    setDateTo(nextRange.dateTo);
    setPage(1);
  };

  const handleDateChange = (setter: (value: string) => void) => (value: string) => {
    setPreset('custom');
    setter(value);
    setPage(1);
  };

  const handleReset = () => {
    const nextRange = getAttendanceReportRange('this_month');
    setSelectedStudent(null);
    setStudentSearch('');
    setPreset('this_month');
    setDateFrom(nextRange.dateFrom);
    setDateTo(nextRange.dateTo);
    setPage(1);
    setExportError(null);
  };

  const handleStudentChange = (value: string) => {
    if (!value) setSelectedStudent(null);
    setPage(1);
  };

  const handleSelectedStudentChange = (value: StudentOption | null) => {
    setSelectedStudent(value);
    setPage(1);
  };

  const handlePrintPreview = () => {
    setIsPreviewOpen(false);
    window.setTimeout(() => printAttendanceReport(printFormat), UI_CONSTANTS.DEFERRED_ACTION_MS);
  };

  const handleExport = async () => {
    if (!selectedStudent || !reportEnabled) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const allRecords = await attendanceService.getAllAttendance({
        student_id: selectedStudent.id,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      exportAttendanceReportCsv(allRecords, selectedStudent, periodLabel);
    } catch (error) {
      setExportError(getErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const summaryContent = (() => {
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
    return <AttendanceSummaryCards summary={summaryQuery.data} totalLabel="catatan" />;
  })();

  const attendanceContent = (() => {
    if (attendanceQuery.isPending) return <div className="p-4"><PageLoader /></div>;
    if (attendanceQuery.isError) {
      return (
        <div className="p-4">
          <AttendanceQueryError
            error={attendanceQuery.error}
            title="Riwayat absensi belum dapat dimuat"
            onRetry={attendanceQuery.refetch}
          />
        </div>
      );
    }
    return isMobile
      ? <div className="p-4"><AttendanceMobileList records={records} /></div>
      : <AttendanceTable records={records} />;
  })();

  if (!canReadStudents) {
    return (
      <Card className="border-hairline bg-surface-1">
        <CardContent className="py-8 text-center text-xs text-ink-subtle">
          Rekap siswa hanya tersedia untuk akun yang memiliki akses daftar siswa.
        </CardContent>
      </Card>
    );
  }

  return (
    <div id="attendance-report-print" className="space-y-4">
      <div className="attendance-report-screen-only">
        <AttendanceReportFilter
          state={{
            studentOptions: studentOptionsQuery.data?.data ?? [],
            selectedStudent,
            studentId,
            preset,
            dateFrom,
            dateTo,
            isStudentOptionsLoading: studentOptionsQuery.isFetching,
            rangeError,
          }}
          actions={{
            onStudentChange: handleStudentChange,
            onSelectedStudentChange: handleSelectedStudentChange,
            onStudentSearchChange: setStudentSearch,
            onPresetChange: handlePresetChange,
            onDateFromChange: handleDateChange(setDateFrom),
            onDateToChange: handleDateChange(setDateTo),
            onReset: handleReset,
          }}
        />
      </div>

      {studentOptionsQuery.error && (
        <div className="attendance-report-screen-only">
          <AttendanceQueryError
            error={studentOptionsQuery.error}
            title="Daftar siswa belum dapat dimuat"
            onRetry={studentOptionsQuery.refetch}
          />
        </div>
      )}

      {!studentId && (
        <div className="attendance-report-screen-only">
          <Card className="border-dashed border-hairline bg-surface-1">
            <CardContent className="py-10 text-center">
              <p className="text-sm font-medium text-ink">Pilih siswa untuk melihat rekap</p>
              <p className="mt-1 text-xs text-ink-subtle">Ringkasan hadir, sakit, izin, alpha, dan riwayat absensi akan tampil di sini.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {reportEnabled && (
        <>
          <section className="attendance-report-page space-y-4">
            {summaryContent}
          </section>

          <section className="attendance-report-page space-y-4">
            <Card className="border-hairline bg-surface-1">
            <CardHeader className="pb-3">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <CardTitle className="text-sm text-ink">
                    {selectedStudent?.nama || 'Rekap absensi siswa'}
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs text-ink-subtle">
                    {selectedStudent?.nis} • {selectedStudent?.kelas} • {periodLabel}
                  </CardDescription>
                </div>
                <div className="attendance-report-screen-only flex flex-wrap items-end gap-2">
                  <ReportFormatSelector
                    name="attendance-report-format"
                    value={printFormat}
                    onValueChange={setPrintFormat}
                    className="min-w-40"
                  />
                  <Button type="button" variant="outline" onClick={() => void handleExport()} disabled={isExporting || records.length === 0} className="min-h-11 border-hairline bg-surface-2 text-xs md:min-h-9">
                    {isExporting ? <Download size={14} className="mr-1.5 animate-pulse" aria-hidden="true" /> : <FileSpreadsheet size={14} className="mr-1.5 text-semantic-success" aria-hidden="true" />}
                    {isExporting ? 'Menyiapkan...' : 'Export CSV'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsPreviewOpen(true)} disabled={records.length === 0} className="min-h-11 border-hairline bg-surface-2 text-xs md:min-h-9">
                    <Printer size={14} className="mr-1.5" aria-hidden="true" />
                    Pratinjau / Cetak PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {attendanceContent}
            </CardContent>
            </Card>
          </section>

          {attendanceQuery.data && attendanceQuery.data.totalPages > 1 && (
            <p className="attendance-report-screen-only text-right text-xs text-ink-tertiary">
              Menampilkan halaman {formatNumber(attendanceQuery.data.page)} dari {formatNumber(attendanceQuery.data.totalPages)} ({formatNumber(attendanceQuery.data.total)} catatan)
            </p>
          )}
          {attendanceQuery.data && attendanceQuery.data.totalPages > 1 && (
            <div className="attendance-report-screen-only flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Sebelumnya</Button>
              <Button type="button" variant="outline" size="sm" disabled={attendanceQuery.isPlaceholderData || page >= attendanceQuery.data.totalPages} onClick={() => setPage((current) => current + 1)}>Berikutnya</Button>
            </div>
          )}
          {exportError && <p className="attendance-report-screen-only text-xs text-semantic-danger" role="alert">{exportError}</p>}
          {summaryQuery.data && records.length > 0 && (
            <ReportPreviewDialog
              dialog={{
                open: isPreviewOpen,
                onOpenChange: setIsPreviewOpen,
              }}
              document={{
                format: printFormat,
                title: "Pratinjau rekap absensi",
                description: "Periksa ukuran halaman sebelum mencetak atau menyimpan PDF.",
                pageClass: "attendance-report-page",
              }}
              actions={{
                onPrint: handlePrintPreview,
              }}
            >
              <div className="space-y-4">
                <section className="attendance-report-page space-y-4">
                  <AttendanceSummaryCards summary={summaryQuery.data} totalLabel="catatan" />
                </section>
                <section className="attendance-report-page space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-ink">{selectedStudent?.nama || 'Rekap absensi siswa'}</h2>
                    <p className="mt-1 text-xs text-ink-subtle">{selectedStudent?.nis} â€¢ {selectedStudent?.kelas} â€¢ {periodLabel}</p>
                  </div>
                  <AttendanceTable records={records} />
                </section>
              </div>
            </ReportPreviewDialog>
          )}
        </>
      )}
    </div>
  );
}
