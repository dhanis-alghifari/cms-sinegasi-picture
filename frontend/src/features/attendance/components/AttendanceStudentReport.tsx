import { useState } from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { PageLoader } from '@/shared/ui/LoadingSpinner';
import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { useIsMobile } from '@/shared/hooks/use-mobile';

import { useStudentOptionsQuery } from '@/features/students/hooks/useStudentOptionsQuery';
import type { StudentOption } from '@/features/students/types/students.types';
import { AttendanceMobileList } from './AttendanceMobileList';
import { AttendanceReportFilter } from './AttendanceReportFilter';
import { AttendanceSummaryCards } from './AttendanceSummaryCards';
import { AttendanceTable } from './AttendanceTable';
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
}

export function AttendanceStudentReport({ canReadStudents }: AttendanceStudentReportProps) {
  const isMobile = useIsMobile();
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [preset, setPreset] = useState<AttendanceReportPreset>('this_month');
  const initialRange = getAttendanceReportRange('this_month');
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const pageSize = 50;

  const studentOptionsQuery = useStudentOptionsQuery(studentSearch, canReadStudents);
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
  const reportEnabled = Boolean(canReadStudents && studentId && !rangeError);
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
      <AttendanceReportFilter
        studentOptions={studentOptionsQuery.data?.data ?? []}
        selectedStudent={selectedStudent}
        studentId={studentId}
        preset={preset}
        dateFrom={dateFrom}
        dateTo={dateTo}
        isStudentOptionsLoading={studentOptionsQuery.isFetching}
        rangeError={rangeError}
        onStudentChange={(value) => {
          if (!value) setSelectedStudent(null);
          setPage(1);
        }}
        onSelectedStudentChange={(value) => {
          setSelectedStudent(value);
          setPage(1);
        }}
        onStudentSearchChange={setStudentSearch}
        onPresetChange={handlePresetChange}
        onDateFromChange={handleDateChange(setDateFrom)}
        onDateToChange={handleDateChange(setDateTo)}
        onReset={handleReset}
      />

      {studentOptionsQuery.error && (
        <Card className="border-semantic-danger/30 bg-semantic-danger/10">
          <CardContent className="pt-5 text-xs text-semantic-danger">{getErrorMessage(studentOptionsQuery.error)}</CardContent>
        </Card>
      )}

      {!studentId && (
        <Card className="border-dashed border-hairline bg-surface-1">
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-ink">Pilih siswa untuk melihat rekap</p>
            <p className="mt-1 text-xs text-ink-subtle">Ringkasan hadir, sakit, izin, alpha, dan riwayat absensi akan tampil di sini.</p>
          </CardContent>
        </Card>
      )}

      {reportEnabled && (
        <>
          {summaryQuery.isLoading ? (
            <PageLoader />
          ) : (
            <AttendanceSummaryCards summary={summaryQuery.data} totalLabel="catatan" />
          )}

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
                <div className="attendance-report-screen-only flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void handleExport()} disabled={isExporting || records.length === 0} className="min-h-11 border-hairline bg-surface-2 text-xs md:min-h-9">
                    {isExporting ? <Download size={14} className="mr-1.5 animate-pulse" aria-hidden="true" /> : <FileSpreadsheet size={14} className="mr-1.5 text-semantic-success" aria-hidden="true" />}
                    {isExporting ? 'Menyiapkan...' : 'Export CSV'}
                  </Button>
                  <Button type="button" variant="outline" onClick={printAttendanceReport} disabled={records.length === 0} className="min-h-11 border-hairline bg-surface-2 text-xs md:min-h-9">
                    <Printer size={14} className="mr-1.5" aria-hidden="true" />
                    Cetak / Simpan PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {attendanceQuery.isLoading ? (
                <div className="p-4"><PageLoader /></div>
              ) : isMobile ? (
                <div className="p-4"><AttendanceMobileList records={records} /></div>
              ) : (
                <AttendanceTable records={records} />
              )}
            </CardContent>
          </Card>

          {attendanceQuery.data && attendanceQuery.data.totalPages > 1 && (
            <p className="text-right text-xs text-ink-tertiary">
              Menampilkan halaman {attendanceQuery.data.page} dari {attendanceQuery.data.totalPages} ({attendanceQuery.data.total} catatan)
            </p>
          )}
          {attendanceQuery.data && attendanceQuery.data.totalPages > 1 && (
            <div className="attendance-report-screen-only flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Sebelumnya</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= attendanceQuery.data.totalPages} onClick={() => setPage((current) => current + 1)}>Berikutnya</Button>
            </div>
          )}
          {exportError && <p className="text-xs text-semantic-danger" role="alert">{exportError}</p>}
        </>
      )}
    </div>
  );
}
