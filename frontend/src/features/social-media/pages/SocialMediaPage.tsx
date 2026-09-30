import { useMemo, useRef, useState } from 'react';
import { BarChart3, FileText, Image as ImageIcon, Link2, Megaphone, Plus, RefreshCw, Users } from 'lucide-react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { Link } from 'react-router-dom';
import { hasCapability } from '@/shared/auth/capabilities';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { PageHeader } from '@/shared/ui/PageHeader';
import { EmptyState } from '@/shared/ui/EmptyState';
import { DataTableSkeleton, RefreshingIndicator } from '@/shared/ui/LoadingSkeletons';
import { Pagination } from '@/shared/ui/Pagination';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { formatNumber } from '@/shared/utils/formatNumber';
import { useCreateSocialPublicationMutation, useFinalizeSocialInsightMutation, useFinalizeSocialPublicationMutation, useSocialAccountsQuery, useSocialMetricsQuery, useSocialPublicationsQuery, useSocialReportQuery, useUploadInsightEvidenceMutation, useUploadPublicationEvidenceMutation } from '../hooks/useSocialMediaQueries';
import { SocialAccountManager } from '../components/SocialAccountManager';
import { SocialGrowthForms } from '../components/SocialGrowthForms';
import { SocialPublicationForm } from '../components/SocialPublicationForm';
import { SocialReportDialog } from '../components/SocialReportDialog';
import { ResumePublicationDialog } from '../components/ResumePublicationDialog';
import { ResumeInsightDialog } from '../components/ResumeInsightDialog';
import type { CreatePublicationInput, SocialInsightPeriod, SocialPublication, SocialPublicationFilters } from '../types/socialMedia.types';
import { getDefaultSocialDateRange, getJakartaToday, getSocialDateRangeError, formatSocialDateRange } from '../utils/socialMediaDates';
import { SOCIAL_CONTENT_LABELS, SOCIAL_PLATFORM_LABELS } from '../utils/publicationRules';
import { printReport } from '@/shared/utils/printReport';
import type { ReportPrintFormat } from '@/shared/types/report';

type SocialTab = 'publications' | 'growth' | 'reports';

interface PendingPublicationWorkflow {
  signature: string;
  createKey: string;
  uploadKey: string;
  finalizeKey: string;
  publication?: SocialPublication;
}

function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

function getPublicationStatusLabel(status: SocialPublication['status']): string {
  if (status === 'recorded') return 'Tercatat';
  if (status === 'archived') return 'Diarsipkan';
  return 'Draft';
}

function getPublicationStatusClass(status: SocialPublication['status']): string {
  if (status === 'recorded') return 'bg-semantic-success/10 text-semantic-success';
  if (status === 'archived') return 'bg-surface-2 text-ink-tertiary';
  return 'bg-semantic-warning/10 text-semantic-warning';
}

function formatSnapshotGrowth(snapshot: { growth_count: number | null; growth_percent: number | null }): string {
  if (snapshot.growth_count === null) return 'Baseline';
  const delta = `${snapshot.growth_count > 0 ? '+' : ''}${formatNumber(snapshot.growth_count)}`;
  return snapshot.growth_percent === null ? delta : `${delta} (${snapshot.growth_percent}%)`;
}

function DateRangeControls({ from, to, onChange }: { from: string; to: string; onChange: (range: { from: string; to: string }) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">
    <label className="space-y-1 text-xs text-ink-subtle"><span>Dari tanggal</span><Input type="date" max={getJakartaToday()} value={from} onChange={(event) => onChange({ from: event.target.value, to })} className="min-h-11" /></label>
    <label className="space-y-1 text-xs text-ink-subtle"><span>Sampai tanggal</span><Input type="date" max={getJakartaToday()} value={to} onChange={(event) => onChange({ from, to: event.target.value })} className="min-h-11" /></label>
  </div>;
}

function PublicationCard({ publication, accountName, canResume, onResume }: { publication: SocialPublication; accountName: string; canResume: boolean; onResume: (publication: SocialPublication) => void }) {
  return <article className="space-y-3 rounded-xl border border-hairline bg-surface-1 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="font-semibold text-ink">{publication.caption}</p><p className="mt-1 text-xs text-ink-subtle">{SOCIAL_PLATFORM_LABELS[publication.platform]} · {SOCIAL_CONTENT_LABELS[publication.content_type]} · {accountName}</p></div>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getPublicationStatusClass(publication.status)}`}>{getPublicationStatusLabel(publication.status)}</span>
    </div>
    <p className="text-xs text-ink-subtle">Tayang {formatDate(publication.published_at)}</p>
    {publication.platform_url && <a href={publication.platform_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 max-w-full items-center gap-2 break-all text-sm text-primary underline underline-offset-2"><Link2 size={15} aria-hidden="true" />Buka tautan konten</a>}
    {publication.evidence.length > 0 && <p className="inline-flex items-center gap-2 text-xs text-ink-subtle"><ImageIcon size={14} aria-hidden="true" />{publication.evidence.length} bukti foto privat terlampir</p>}
    {canResume && publication.status === 'draft' && <div><Button type="button" variant="outline" className="min-h-11" onClick={() => onResume(publication)}><FileText size={15} aria-hidden="true" /> Lanjutkan draft</Button></div>}
  </article>;
}

function MetricSummary({ accounts, snapshots, insightPeriods, rangeLabel, canResume, onResume }: { accounts: { id: string; platform: string; account_name: string }[]; snapshots: NonNullable<ReturnType<typeof useSocialMetricsQuery>['data']>['snapshots']; insightPeriods: NonNullable<ReturnType<typeof useSocialMetricsQuery>['data']>['insight_periods']; rangeLabel: string; canResume: boolean; onResume: (period: SocialInsightPeriod) => void }) {
  const byAccount = new Map(accounts.map((account) => [account.id, account]));
  return <section className="space-y-4" aria-label="Ringkasan pertumbuhan akun">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-hairline bg-surface-1 p-4"><p className="text-xs text-ink-subtle">Catatan pengikut</p><p className="mt-2 text-2xl font-semibold text-ink">{formatNumber(snapshots.length)}</p></div>
      <div className="rounded-xl border border-hairline bg-surface-1 p-4"><p className="text-xs text-ink-subtle">Grafik insight</p><p className="mt-2 text-2xl font-semibold text-ink">{formatNumber(insightPeriods.length)}</p></div>
      <div className="rounded-xl border border-hairline bg-surface-1 p-4"><p className="text-xs text-ink-subtle">Platform aktif</p><p className="mt-2 text-2xl font-semibold text-ink">{formatNumber(accounts.length)}</p></div>
      <div className="rounded-xl border border-hairline bg-surface-1 p-4"><p className="text-xs text-ink-subtle">Rentang yang dipilih</p><p className="mt-2 text-sm font-semibold text-ink">{rangeLabel}</p></div>
    </div>
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">Riwayat pengikut dan grafik</h3>
      {snapshots.length === 0 && insightPeriods.length === 0 ? <EmptyState icon={BarChart3} title="Belum ada data pertumbuhan" description="Catat jumlah pengikut atau unggah grafik insight untuk mulai melihat perkembangan akun." /> : <div className="space-y-2">
        {snapshots.map((snapshot) => {
          const account = byAccount.get(snapshot.social_account_id);
          const growthLabel = formatSnapshotGrowth(snapshot);
          return <article key={snapshot.id} className="grid gap-2 rounded-lg border border-hairline bg-surface-1 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div><p className="text-sm font-semibold">{account?.account_name ?? SOCIAL_PLATFORM_LABELS[snapshot.platform]}</p><p className="text-xs text-ink-subtle">{SOCIAL_PLATFORM_LABELS[snapshot.platform]} · {formatDate(snapshot.as_of_date)}</p></div><p className="text-sm"><span className="text-ink-subtle">Pengikut </span><strong>{formatNumber(snapshot.audience_count)}</strong></p><p className="text-sm"><span className="text-ink-subtle">Pertumbuhan </span><strong className={snapshot.growth_count !== null && snapshot.growth_count > 0 ? 'text-semantic-success' : ''}>{growthLabel}</strong></p></article>;
        })}
        {insightPeriods.map((period) => {
          const account = byAccount.get(period.social_account_id);
          const showMetric = (value: number | null) => value === null ? '—' : formatNumber(value);
          return <article key={period.id} className="grid gap-3 rounded-lg border border-hairline bg-surface-1 p-3 sm:grid-cols-[minmax(0,1fr)_repeat(5,auto)] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{account?.account_name ?? SOCIAL_PLATFORM_LABELS[period.platform]}</p>{period.status === 'draft' && <span className="rounded-full bg-semantic-warning/10 px-2 py-0.5 text-[10px] font-medium text-semantic-warning">Draft</span>}</div><p className="text-xs text-ink-subtle">{SOCIAL_PLATFORM_LABELS[period.platform]} · {formatDate(period.period_start)} – {formatDate(period.period_end)}</p></div><p className="text-xs"><span className="text-ink-subtle">Views </span><strong>{showMetric(period.views)}</strong></p><p className="text-xs"><span className="text-ink-subtle">Jangkauan </span><strong>{showMetric(period.reach)}</strong></p><p className="text-xs"><span className="text-ink-subtle">Interaksi </span><strong>{showMetric(period.interactions)}</strong></p><p className="text-xs"><span className="text-ink-subtle">Kunjungan profil </span><strong>{showMetric(period.profile_visits)}</strong></p><p className="text-xs"><span className="text-ink-subtle">Konten tayang </span><strong>{showMetric(period.published_count)}</strong></p><p className="inline-flex items-center gap-1 text-[11px] text-ink-tertiary sm:col-span-full"><ImageIcon size={13} aria-hidden="true" />{period.evidence.filter((item) => item.upload_status === 'attached').length} screenshot grafik privat</p>{canResume && period.status === 'draft' && <div className="sm:col-span-full"><Button type="button" variant="outline" className="min-h-11" onClick={() => onResume(period)}><FileText size={15} aria-hidden="true" /> Lanjutkan draft</Button></div>}</article>;
        })}
      </div>}
    </div>
  </section>;
}

export function SocialMediaPage() {
  const { user } = useAuthStore();
  const canRead = hasCapability(user, 'social_media.read');
  const canManagePublications = hasCapability(user, 'social_media.publications.manage');
  const canManageMetrics = hasCapability(user, 'social_media.metrics.manage');
  const canManageAccounts = hasCapability(user, 'social_media.accounts.manage');
  const canWriteAgenda = hasCapability(user, 'agenda.write');
  const initialRange = useMemo(() => getDefaultSocialDateRange(), []);
  const [tab, setTab] = useState<SocialTab>('publications');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);
  const [resumeTarget, setResumeTarget] = useState<SocialPublication | null>(null);
  const [resumeInsightTarget, setResumeInsightTarget] = useState<SocialInsightPeriod | null>(null);
  const [isSubmittingPublication, setIsSubmittingPublication] = useState(false);
  const publicationWorkflow = useRef<PendingPublicationWorkflow | null>(null);
  const resumeUploadKeys = useRef(new Map<string, { fileIdentity: string; key: string }>());
  const resumeInsightUploadKeys = useRef(new Map<string, { fileIdentity: string; key: string }>());
  const dateFilters = { from, to };
  const dateRangeError = getSocialDateRangeError(dateFilters);
  const publicationFilters: SocialPublicationFilters = { from, to, page, pageSize: UI_CONSTANTS.DEFAULT_PAGE_SIZE };

  const accountsQuery = useSocialAccountsQuery(canRead, canManageAccounts);
  const publicationsQuery = useSocialPublicationsQuery(publicationFilters, canRead && tab === 'publications' && !dateRangeError);
  const metricsQuery = useSocialMetricsQuery(dateFilters, canRead && tab === 'growth' && !dateRangeError);
  const reportQuery = useSocialReportQuery(dateFilters, canRead && reportOpen && !dateRangeError);
  const createPublication = useCreateSocialPublicationMutation();
  const uploadEvidence = useUploadPublicationEvidenceMutation();
  const finalizePublication = useFinalizeSocialPublicationMutation();
  const uploadInsightEvidence = useUploadInsightEvidenceMutation();
  const finalizeInsight = useFinalizeSocialInsightMutation();
  const accounts = accountsQuery.data ?? [];
  const publications = publicationsQuery.data?.data ?? [];
  const accountNames = new Map(accounts.map((account) => [account.id, account.account_name]));
  const isBusy = isSubmittingPublication || createPublication.isPending || uploadEvidence.isPending || finalizePublication.isPending;

  const recordPublication = async (input: CreatePublicationInput, evidence: File | null) => {
    const signature = JSON.stringify({ input, evidence: evidence ? [evidence.name, evidence.size, evidence.lastModified] : null });
    const pending = publicationWorkflow.current?.signature === signature ? publicationWorkflow.current : {
      signature,
      createKey: crypto.randomUUID(),
      uploadKey: crypto.randomUUID(),
      finalizeKey: crypto.randomUUID(),
    };
    publicationWorkflow.current = pending;
    setIsSubmittingPublication(true);
    try {
      let publication = pending.publication;
      if (!publication) {
        publication = await createPublication.mutateAsync({ input, idempotencyKey: pending.createKey });
        publicationWorkflow.current = { ...pending, publication };
      }
      if (evidence && publication.status !== 'recorded') {
        await uploadEvidence.mutateAsync({ id: publication.id, file: evidence, idempotencyKey: pending.uploadKey });
        await finalizePublication.mutateAsync({ id: publication.id, version: publication.version, idempotencyKey: pending.finalizeKey });
      }
      publicationWorkflow.current = null;
      setPage(1);
    } finally {
      setIsSubmittingPublication(false);
    }
  };

  const resumePublication = async (publication: SocialPublication, evidence: File | null) => {
    const currentRows = await publicationsQuery.refetch();
    let current = currentRows.data?.data.find((item) => item.id === publication.id) ?? publication;
    if (current.status === 'recorded') { setResumeTarget(null); return; }
    const alreadyHasEvidence = current.evidence.some((item) => item.upload_status === 'attached');
    if (evidence && !alreadyHasEvidence) {
      const fileIdentity = `${evidence.name}:${evidence.size}:${evidence.lastModified}`;
      const existingKey = resumeUploadKeys.current.get(publication.id);
      const uploadKey = existingKey?.fileIdentity === fileIdentity ? existingKey.key : crypto.randomUUID();
      resumeUploadKeys.current.set(publication.id, { fileIdentity, key: uploadKey });
      try {
        await uploadEvidence.mutateAsync({ id: publication.id, file: evidence, idempotencyKey: uploadKey });
        resumeUploadKeys.current.delete(publication.id);
      } catch (uploadError) {
        const refreshed = await publicationsQuery.refetch();
        const latest = refreshed.data?.data.find((item) => item.id === publication.id);
        if (latest) {
          setResumeTarget(latest);
          if (latest.evidence.some((item) => item.upload_status === 'attached')) resumeUploadKeys.current.delete(publication.id);
        }
        throw uploadError;
      }
      const refreshed = await publicationsQuery.refetch();
      const latest = refreshed.data?.data.find((item) => item.id === publication.id);
      if (latest) current = latest;
      else current = {
        ...current,
        evidence: [...current.evidence, {
          id: `uploaded-${crypto.randomUUID()}`,
          upload_status: 'attached',
          mime_type: evidence.type,
          file_size_bytes: evidence.size,
          original_filename: evidence.name,
          created_at: new Date().toISOString(),
        }],
      };
      setResumeTarget(current);
    }
    await finalizePublication.mutateAsync({ id: publication.id, version: current.version, idempotencyKey: crypto.randomUUID() });
    setResumeTarget(null);
  };

  const resumeInsight = async (period: SocialInsightPeriod, evidence: File | null) => {
    const currentRows = await metricsQuery.refetch();
    let current = currentRows.data?.insight_periods.find((item) => item.id === period.id) ?? period;
    if (current.status === 'recorded') { setResumeInsightTarget(null); return; }
    let hasAttachedEvidence = current.evidence.some((item) => item.upload_status === 'attached');
    if (evidence && !hasAttachedEvidence) {
      const fileIdentity = `${evidence.name}:${evidence.size}:${evidence.lastModified}`;
      const existingKey = resumeInsightUploadKeys.current.get(period.id);
      const uploadKey = existingKey?.fileIdentity === fileIdentity ? existingKey.key : crypto.randomUUID();
      resumeInsightUploadKeys.current.set(period.id, { fileIdentity, key: uploadKey });
      try {
        await uploadInsightEvidence.mutateAsync({ id: period.id, file: evidence, idempotencyKey: uploadKey });
        resumeInsightUploadKeys.current.delete(period.id);
      } catch (uploadError) {
        const refreshed = await metricsQuery.refetch();
        const latest = refreshed.data?.insight_periods.find((item) => item.id === period.id);
        if (latest) {
          setResumeInsightTarget(latest);
          if (latest.evidence.some((item) => item.upload_status === 'attached')) resumeInsightUploadKeys.current.delete(period.id);
        }
        throw uploadError;
      }
      const refreshed = await metricsQuery.refetch();
      const latest = refreshed.data?.insight_periods.find((item) => item.id === period.id);
      if (latest) current = latest;
      else current = {
        ...current,
        evidence: [...current.evidence, {
          id: `uploaded-${crypto.randomUUID()}`,
          upload_status: 'attached',
          mime_type: evidence.type,
          file_size_bytes: evidence.size,
          original_filename: evidence.name,
          created_at: new Date().toISOString(),
        }],
      };
      setResumeInsightTarget(current);
      hasAttachedEvidence = current.evidence.some((item) => item.upload_status === 'attached');
    }
    if (!hasAttachedEvidence) throw new Error('Unggah screenshot grafik sebelum menyelesaikan insight.');
    await finalizeInsight.mutateAsync({ id: period.id, version: current.version, idempotencyKey: crypto.randomUUID() });
    setResumeInsightTarget(null);
  };

  const printSocialReport = (format: ReportPrintFormat) => printReport({ rootId: 'social-report-print', format, a4Orientation: 'landscape', screenOnlyClass: 'social-report-screen-only', pageClass: 'social-report-page', slideClass: 'social-report-slide' });

  const tabs: Array<{ id: SocialTab; label: string; icon: typeof Megaphone }> = [
    { id: 'publications', label: 'Publikasi', icon: Megaphone },
    { id: 'growth', label: 'Pertumbuhan akun', icon: BarChart3 },
    { id: 'reports', label: 'Laporan', icon: FileText },
  ];

  return <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
    <PageHeader title="Humas & Media Sosial" subtitle="Catat kegiatan, publikasi konten, dan perkembangan akun resmi Sinegasi Picture." />
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-hairline bg-surface-2 p-1" role="tablist" aria-label="Menu Humas dan media sosial">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${tab === id ? 'bg-surface-1 font-semibold text-ink shadow-sm' : 'text-ink-subtle hover:text-ink'}`}><Icon size={16} aria-hidden="true" />{label}</button>)}
    </div>

    <section className="rounded-xl border border-hairline bg-surface-1 p-3 sm:p-4" aria-label="Filter rentang tanggal">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><DateRangeControls from={from} to={to} onChange={(range) => { setFrom(range.from); setTo(range.to); setPage(1); }} /><Button type="button" variant="outline" className="min-h-11" onClick={() => { const range = getDefaultSocialDateRange(); setFrom(range.from); setTo(range.to); setPage(1); }}><RefreshCw size={14} aria-hidden="true" /> 30 hari terakhir</Button></div>
      <p className="mt-2 text-xs text-ink-tertiary">Rentang: {formatSocialDateRange(dateFilters)}. Laporan cetak dibatasi maksimal 366 hari.</p>
      {dateRangeError && <p role="alert" className="mt-2 text-xs text-semantic-danger">{dateRangeError}</p>}
    </section>

    {accountsQuery.isPending && <DataTableSkeleton columns={3} rows={3} label="Memuat akun media sosial..." />}
    {accountsQuery.isError && <QueryErrorState title="Daftar akun media sosial belum dapat dimuat" error={accountsQuery.error} onRetry={() => void accountsQuery.refetch()} />}
    {!accountsQuery.isPending && !accountsQuery.isError && canManageAccounts && <SocialAccountManager accounts={accounts} />}

    {tab === 'publications' && !dateRangeError && <section className="space-y-4" aria-label="Publikasi media sosial">
      {canManagePublications && <>
        {canWriteAgenda && <Link to="/agenda" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm font-medium text-primary hover:bg-surface-2"><Plus size={15} aria-hidden="true" /> Catat kegiatan SP di Agenda</Link>}
        <SocialPublicationForm accounts={accounts} isSaving={isBusy} onSubmit={recordPublication} />
      </>}
      {publicationsQuery.isPending && <DataTableSkeleton columns={4} rows={5} label="Memuat publikasi..." />}
      {publicationsQuery.isError && <QueryErrorState title="Publikasi belum dapat dimuat" error={publicationsQuery.error} onRetry={() => void publicationsQuery.refetch()} />}
      {!publicationsQuery.isPending && !publicationsQuery.isError && <>
        <RefreshingIndicator visible={publicationsQuery.isFetching} />
        {publications.length === 0 ? <EmptyState icon={Megaphone} title="Belum ada publikasi" description="Konten yang telah tayang akan muncul di sini setelah dicatat." /> : <div className="space-y-3">{publications.map((publication) => <PublicationCard key={publication.id} publication={publication} accountName={accountNames.get(publication.social_account_id) ?? SOCIAL_PLATFORM_LABELS[publication.platform]} canResume={canManagePublications} onResume={setResumeTarget} />)}</div>}
        <Pagination page={publicationsQuery.data?.page ?? page} totalPages={publicationsQuery.data?.totalPages ?? 1} total={publicationsQuery.data?.total ?? 0} pageSize={publicationsQuery.data?.pageSize ?? UI_CONSTANTS.DEFAULT_PAGE_SIZE} onPageChange={setPage} />
      </>}
    </section>}

    {tab === 'growth' && !dateRangeError && <section className="space-y-5" aria-label="Pertumbuhan akun media sosial">
      {canManageMetrics && <SocialGrowthForms accounts={accounts} />}
      {metricsQuery.isPending && <DataTableSkeleton columns={4} rows={4} label="Memuat metrik akun..." />}
      {metricsQuery.isError && <QueryErrorState title="Metrik pertumbuhan belum dapat dimuat" error={metricsQuery.error} onRetry={() => void metricsQuery.refetch()} />}
      {!metricsQuery.isPending && !metricsQuery.isError && <><RefreshingIndicator visible={metricsQuery.isFetching} /><MetricSummary accounts={accounts} snapshots={metricsQuery.data?.snapshots ?? []} insightPeriods={metricsQuery.data?.insight_periods ?? []} rangeLabel={formatSocialDateRange(dateFilters)} canResume={canManageMetrics} onResume={setResumeInsightTarget} /></>}
    </section>}

    {tab === 'reports' && <section className="space-y-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText size={18} aria-hidden="true" /></div><div><h2 className="font-semibold text-ink">Laporan lengkap Humas</h2><p className="mt-1 text-sm text-ink-subtle">Menggabungkan kegiatan Agenda, publikasi, snapshot pengikut, dan grafik insight pada rentang tanggal terpilih. Cetak hanya aktif bila semua data dan gambar bukti sudah siap.</p></div></div>
      <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={Boolean(dateRangeError)} onClick={() => setReportOpen(true)}><FileText size={16} aria-hidden="true" /> Muat pratinjau laporan</Button>
    </section>}

    {!canManagePublications && !canManageMetrics && !canManageAccounts && <EmptyState icon={Users} title="Akses baca saja" description="Akun ini dapat melihat laporan Humas, tetapi tidak memiliki izin untuk mengubah data." />}
    <SocialReportDialog open={reportOpen} onOpenChange={setReportOpen} report={reportQuery.data} isLoading={reportQuery.isPending} error={reportQuery.error} onRetry={() => void reportQuery.refetch()} onPrint={printSocialReport} />
    <ResumePublicationDialog publication={resumeTarget} onOpenChange={(open) => { if (!open) setResumeTarget(null); }} onSubmit={resumePublication} />
    <ResumeInsightDialog period={resumeInsightTarget} onOpenChange={(open) => { if (!open) setResumeInsightTarget(null); }} onSubmit={resumeInsight} />
  </div>;
}
