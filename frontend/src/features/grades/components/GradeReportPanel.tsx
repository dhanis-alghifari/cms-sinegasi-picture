import { useMemo, useState } from 'react';
import { CheckCircle2, FileText, RefreshCw, ShieldCheck } from 'lucide-react';

import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { StatusBadge } from '@/shared/ui/StatusBadge';

import {
  useApproveReportsMutation,
  useCreateReportPeriodMutation,
  useCreatePklPeriodMutation,
  useGenerateReportsMutation,
  usePklPeriodsQuery,
  useReportPeriodsQuery,
  useReviewPklPeriodMutation,
  useReportsQuery,
} from '../hooks/useGradeReports';
import type { GradeReportPeriod, ReportSemester } from '../types/grades.types';

type ReportStudent = { id: string; nis: string; nama: string; kelas: string };

function defaultPeriod(): { academic_year: string; semester: ReportSemester; start_date: string; end_date: string } {
  const year = new Date().getFullYear();
  return { academic_year: `${year}/${year + 1}`, semester: 'ganjil', start_date: `${year}-07-01`, end_date: `${year}-12-31` };
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

function periodLabel(period: GradeReportPeriod): string {
  return `${period.academic_year} · Semester ${period.semester === 'ganjil' ? 'Ganjil' : 'Genap'}`;
}

function reportVariant(predikat: string): 'success' | 'primary' | 'warning' | 'danger' {
  if (predikat === 'A') return 'success';
  if (predikat === 'B') return 'primary';
  if (predikat === 'C') return 'warning';
  return 'danger';
}

function pklVariant(status: string): 'success' | 'primary' | 'warning' | 'danger' | 'neutral' {
  if (status === 'approved' || status === 'completed') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function pklLabel(status: string): string {
  if (status === 'approved') return 'Disetujui';
  if (status === 'completed') return 'Selesai';
  if (status === 'rejected') return 'Ditolak';
  return 'Menunggu review';
}

export function GradeReportPanel({ students = [] }: { students?: ReportStudent[] }) {
  const [draft, setDraft] = useState(defaultPeriod);
  const [pklDraft, setPklDraft] = useState({ student_id: '', start_date: defaultPeriod().start_date, end_date: defaultPeriod().end_date, institution: '', notes: '' });
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>();
  const periodsQuery = useReportPeriodsQuery();
  const activePeriodId = selectedPeriodId ?? periodsQuery.data?.[0]?.id;
  const reportsQuery = useReportsQuery(activePeriodId);
  const createPeriod = useCreateReportPeriodMutation();
  const generateReports = useGenerateReportsMutation();
  const approveReports = useApproveReportsMutation();
  const pklPeriodsQuery = usePklPeriodsQuery();
  const createPkl = useCreatePklPeriodMutation();
  const reviewPkl = useReviewPklPeriodMutation();

  const selectedPeriod = useMemo(
    () => periodsQuery.data?.find((period) => period.id === activePeriodId),
    [periodsQuery.data, activePeriodId],
  );
  const hasIncompleteReports = (reportsQuery.data ?? []).some((report) => !report.predikat);

  const handleCreatePeriod = async () => {
    const period = await createPeriod.mutateAsync(draft);
    setSelectedPeriodId(period.id);
  };

  const handleCreatePkl = async () => {
    if (!pklDraft.student_id || !pklDraft.institution.trim()) return;
    await createPkl.mutateAsync({ ...pklDraft, institution: pklDraft.institution.trim(), notes: pklDraft.notes.trim() || undefined });
    setPklDraft((current) => ({ ...current, institution: '', notes: '' }));
  };

  return (
    <div className="space-y-4">
      <Card className="border-hairline bg-surface-1 shadow-none">
        <CardHeader className="gap-2 border-b border-hairline">
          <CardTitle className="flex items-center gap-2 text-ink"><FileText className="size-4 text-primary" />Raport sekolah</CardTitle>
          <CardDescription>Rekap internal per semester dengan predikat A–E. PKL yang sudah disetujui tidak dihitung sebagai alpha.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-5">
          <label className="space-y-1 text-xs font-medium text-ink-subtle">Tahun ajaran<Input value={draft.academic_year} onChange={(event) => setDraft((value) => ({ ...value, academic_year: event.target.value }))} placeholder="2026/2027" /></label>
          <label className="space-y-1 text-xs font-medium text-ink-subtle">Semester
            <Select value={draft.semester} onValueChange={(value) => value && setDraft((current) => ({ ...current, semester: value as ReportSemester }))}>
              <SelectTrigger aria-label="Semester raport"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ganjil">Ganjil</SelectItem><SelectItem value="genap">Genap</SelectItem></SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-xs font-medium text-ink-subtle">Mulai<Input type="date" value={draft.start_date} onChange={(event) => setDraft((value) => ({ ...value, start_date: event.target.value }))} /></label>
          <label className="space-y-1 text-xs font-medium text-ink-subtle">Selesai<Input type="date" value={draft.end_date} onChange={(event) => setDraft((value) => ({ ...value, end_date: event.target.value }))} /></label>
          <Button type="button" onClick={handleCreatePeriod} disabled={createPeriod.isPending} className="self-end"><FileText className="size-4" />Buat periode</Button>
        </CardContent>
        {errorMessage(createPeriod.error) && <p className="px-4 pb-4 text-xs text-semantic-danger">{errorMessage(createPeriod.error)}</p>}
      </Card>

      <Card className="border-hairline bg-surface-1 shadow-none">
        <CardHeader className="gap-2 border-b border-hairline"><CardTitle className="text-ink">Periode PKL terverifikasi</CardTitle><CardDescription>Ajukan periode PKL terpisah dari presensi. Setelah disetujui, hari tersebut tidak dihitung sebagai alpha.</CardDescription></CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-3 md:grid-cols-5">
            <label className="space-y-1 text-xs font-medium text-ink-subtle md:col-span-2">Siswa
              <Select value={pklDraft.student_id || undefined} onValueChange={(value) => value && setPklDraft((current) => ({ ...current, student_id: value }))}>
                <SelectTrigger aria-label="Siswa PKL"><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
                <SelectContent>{students.map((student) => <SelectItem key={student.id} value={student.id}>{student.nama} · {student.nis} · {student.kelas}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-xs font-medium text-ink-subtle">Mulai<Input type="date" value={pklDraft.start_date} onChange={(event) => setPklDraft((current) => ({ ...current, start_date: event.target.value }))} /></label>
            <label className="space-y-1 text-xs font-medium text-ink-subtle">Selesai<Input type="date" value={pklDraft.end_date} onChange={(event) => setPklDraft((current) => ({ ...current, end_date: event.target.value }))} /></label>
            <Button type="button" onClick={handleCreatePkl} disabled={createPkl.isPending || !pklDraft.student_id || !pklDraft.institution.trim()} className="self-end">Ajukan PKL</Button>
          </div>
          <Input aria-label="Tempat PKL" placeholder="Tempat PKL / perusahaan" value={pklDraft.institution} onChange={(event) => setPklDraft((current) => ({ ...current, institution: event.target.value }))} />
          {errorMessage(createPkl.error) && <p className="text-xs text-semantic-danger">{errorMessage(createPkl.error)}</p>}
          {(pklPeriodsQuery.data?.length ?? 0) > 0 && <div className="overflow-x-auto rounded-lg border border-hairline"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-surface-2 text-xs text-ink-subtle"><tr><th className="px-3 py-2">Siswa</th><th className="px-3 py-2">Periode</th><th className="px-3 py-2">Tempat</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Aksi</th></tr></thead><tbody>{(pklPeriodsQuery.data ?? []).map((period) => <tr key={period.id} className="border-t border-hairline"><td className="px-3 py-3 text-ink">{period.student_nama || period.student_id}</td><td className="px-3 py-3 text-ink-subtle">{period.start_date} – {period.end_date}</td><td className="px-3 py-3 text-ink-subtle">{period.institution}</td><td className="px-3 py-3"><StatusBadge label={pklLabel(period.status)} variant={pklVariant(period.status)} /></td><td className="px-3 py-3">{period.status === 'pending' && <div className="flex gap-2"><Button type="button" size="xs" onClick={() => reviewPkl.mutate({ id: period.id, status: 'approved' })} disabled={reviewPkl.isPending}>Setujui</Button><Button type="button" size="xs" variant="destructive" onClick={() => reviewPkl.mutate({ id: period.id, status: 'rejected' })} disabled={reviewPkl.isPending}>Tolak</Button></div>}</td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>

      <Card className="border-hairline bg-surface-1 shadow-none">
        <CardHeader className="gap-2 border-b border-hairline sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="text-ink">Tinjau rekap</CardTitle><CardDescription>Generate setelah nilai dan presensi periode tersedia, lalu sahkan setelah diperiksa.</CardDescription></div>
          <div className="w-full sm:w-72">
            <Select value={activePeriodId} onValueChange={(value) => value && setSelectedPeriodId(value)}>
              <SelectTrigger aria-label="Pilih periode raport"><SelectValue placeholder="Pilih periode raport" /></SelectTrigger>
              <SelectContent>{(periodsQuery.data ?? []).map((period) => <SelectItem key={period.id} value={period.id}>{periodLabel(period)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {!selectedPeriod && <p className="rounded-lg border border-dashed border-hairline p-6 text-center text-sm text-ink-subtle">Belum ada periode raport. Buat periode terlebih dahulu.</p>}
          {selectedPeriod && <>
            <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div><span className="font-semibold text-ink">{periodLabel(selectedPeriod)}</span><span className="ml-2 text-ink-subtle">{selectedPeriod.start_date} – {selectedPeriod.end_date}</span></div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={selectedPeriod.status === 'approved' ? 'Disahkan' : 'Draft'} variant={selectedPeriod.status === 'approved' ? 'success' : 'warning'} />
                <Button type="button" size="sm" variant="outline" onClick={() => generateReports.mutate(selectedPeriod.id)} disabled={generateReports.isPending || selectedPeriod.status === 'approved'}><RefreshCw className="size-3.5" />Generate</Button>
                <Button type="button" size="sm" onClick={() => approveReports.mutate(selectedPeriod.id)} disabled={approveReports.isPending || selectedPeriod.status === 'approved' || hasIncompleteReports}><ShieldCheck className="size-3.5" />Sahkan</Button>
              </div>
            </div>
            {(errorMessage(generateReports.error) || errorMessage(approveReports.error)) && <p className="text-xs text-semantic-danger">{errorMessage(generateReports.error) || errorMessage(approveReports.error)}</p>}
            {reportsQuery.isLoading && <p className="text-sm text-ink-subtle">Memuat rekap siswa…</p>}
            {reportsQuery.isError && <p className="text-sm text-semantic-danger">{errorMessage(reportsQuery.error) || 'Rekap belum dapat dimuat.'}</p>}
            {!reportsQuery.isLoading && !reportsQuery.isError && (reportsQuery.data?.length ?? 0) === 0 && <p className="rounded-lg border border-dashed border-hairline p-6 text-center text-sm text-ink-subtle">Belum ada hasil generate.</p>}
            {(reportsQuery.data?.length ?? 0) > 0 && <div className="overflow-x-auto rounded-lg border border-hairline">
              <table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-surface-2 text-xs text-ink-subtle"><tr><th className="px-3 py-2">Siswa</th><th className="px-3 py-2">Kelas</th><th className="px-3 py-2">Predikat</th><th className="px-3 py-2">Bukti</th><th className="px-3 py-2">Presensi</th><th className="px-3 py-2">Keterangan</th></tr></thead><tbody>{(reportsQuery.data ?? []).map((report) => <tr key={report.id} className="border-t border-hairline align-top"><td className="px-3 py-3 font-medium text-ink">{report.student_nama || report.student_nis || report.student_id}<div className="text-xs font-normal text-ink-subtle">{report.student_nis || 'NIS belum tersedia'}</div></td><td className="px-3 py-3 text-ink-subtle">{report.kelas || '—'}</td><td className="px-3 py-3">{report.predikat ? <StatusBadge label={report.predikat} variant={reportVariant(report.predikat)} /> : <StatusBadge label="Belum dinilai" variant="neutral" />}</td><td className="px-3 py-3 text-ink-subtle">{report.evidence_count} tugas</td><td className="px-3 py-3 text-ink-subtle">{report.attendance_percentage == null ? 'Belum tercatat' : `${report.attendance_percentage}%`} {report.pkl_days > 0 && <span className="block text-xs">PKL {report.pkl_days} hari</span>}</td><td className="max-w-[360px] px-3 py-3 text-ink-subtle">{report.deskripsi}</td></tr>)}</tbody></table>
            </div>}
            {selectedPeriod.status !== 'approved' && hasIncompleteReports && (reportsQuery.data?.length ?? 0) > 0 && <p className="flex items-center gap-2 text-xs text-semantic-warning"><CheckCircle2 className="size-3.5" />Laporan belum bisa disahkan karena masih ada siswa tanpa bukti penilaian.</p>}
          </>}
        </CardContent>
      </Card>
    </div>
  );
}
