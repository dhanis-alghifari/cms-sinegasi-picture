import { useMemo, useState } from 'react';
import { DataTableSkeleton } from '@/shared/ui/LoadingSkeletons';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { ImagePreviewDialog } from '@/shared/ui/ImagePreviewDialog';
import { PrivateImage } from '@/shared/ui/PrivateImage';
import { ReportFormatSelector } from '@/shared/ui/report/ReportFormatSelector';
import { ReportPreviewDialog } from '@/shared/ui/report/ReportPreviewDialog';
import type { ReportPrintFormat } from '@/shared/types/report';
import type { SocialEvidence, SocialMonthlyAudienceSeries, SocialReportData } from '../types/socialMedia.types';
import { SocialMonthlyFollowerTrendChart } from './SocialMonthlyFollowerTrendChart';
import { formatSocialMonth } from '../utils/socialMediaDates';
import { formatNumber } from '@/shared/utils/formatNumber';
import { formatSocialArchiveMonth, getSocialInsightMetricEntries, getSocialInsightSourceLabel } from '../utils/socialInsightMetrics';
import { SOCIAL_CONTENT_LABELS, SOCIAL_PLATFORM_LABELS } from '../utils/publicationRules';

interface SocialReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report?: SocialReportData;
  isLoading: boolean;
  error?: unknown;
  onRetry: () => void;
  onPrint: (format: ReportPrintFormat) => void;
}

interface PreviewImage { id: string; src: string; alt: string; label: string; }

function signedImages(report: SocialReportData): PreviewImage[] {
  const images: PreviewImage[] = [];
  for (const publication of report.publications) {
    for (const evidence of publication.evidence) {
      if (evidence.access_url) images.push({ id: `publication:${publication.id}:${evidence.id}`, src: evidence.access_url, alt: `Bukti ${publication.caption}`, label: 'Bukti publikasi' });
    }
  }
  for (const period of report.insight_periods) {
    for (const evidence of period.evidence) {
      if (evidence.access_url) images.push({ id: `insight:${period.id}:${evidence.id}`, src: evidence.access_url, alt: `Grafik ${period.platform} ${period.period_start}–${period.period_end}`, label: 'Grafik insight' });
    }
  }
  return images;
}

function missingImageCount(report: SocialReportData): number {
  return report.publications.reduce((count, publication) => count + publication.evidence.filter((item) => item.upload_status === 'attached' && !item.access_url).length, 0)
    + report.insight_periods.reduce((count, period) => count + period.evidence.filter((item) => item.upload_status === 'attached' && !item.access_url).length, 0);
}

function evidenceFor(evidence: SocialEvidence[], parentId: string, onPreview: (image: PreviewImage) => void, onImageResolved: (id: string, failed: boolean) => void, imageClassName = 'h-12 w-16') {
  if (evidence.length === 0) return <span className="text-ink-tertiary">Tidak ada bukti</span>;
  return <div className="flex flex-wrap gap-1.5">
    {evidence.map((item) => item.access_url ? (
      <button key={item.id} type="button" onClick={() => onPreview({ id: `${parentId}:${item.id}`, src: item.access_url as string, alt: item.original_filename, label: 'Bukti laporan' })} className="rounded border border-hairline bg-white p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Pratinjau ${item.original_filename}`}>
        <PrivateImage src={item.access_url} alt={item.original_filename} className={`${imageClassName} object-contain`} loading="eager" onLoad={() => onImageResolved(`${parentId}:${item.id}`, false)} onError={() => onImageResolved(`${parentId}:${item.id}`, true)} onUnavailable={() => onImageResolved(`${parentId}:${item.id}`, true)} />
      </button>
    ) : <span key={item.id} className="rounded border border-semantic-danger/40 px-2 py-1 text-[10px] text-semantic-danger">Bukti tidak memiliki tautan akses</span>)}
  </div>;
}

function formatDate(value: string | null): string {
  if (!value) return 'Belum dicatat';
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

function accountName(account: SocialMonthlyAudienceSeries | undefined, platform: SocialReportData['publications'][number]['platform']): string {
  return account?.account_name ?? SOCIAL_PLATFORM_LABELS[platform];
}

interface PublicationSummary {
  accountId: string;
  platform: SocialReportData['publications'][number]['platform'];
  accountName: string;
  total: number;
  contentCounts: Map<string, number>;
}

function getPublicationSummaries(report: SocialReportData): PublicationSummary[] {
  const accountsById = new Map(report.monthly_growth.map((account) => [account.id, account]));
  const summaries = new Map<string, PublicationSummary>();
  for (const publication of report.publications) {
    const summary = summaries.get(publication.social_account_id) ?? {
      accountId: publication.social_account_id,
      platform: publication.platform,
      accountName: accountName(accountsById.get(publication.social_account_id), publication.platform),
      total: 0,
      contentCounts: new Map<string, number>(),
    };
    summary.total += 1;
    summary.contentCounts.set(publication.content_type, (summary.contentCounts.get(publication.content_type) ?? 0) + 1);
    summaries.set(publication.social_account_id, summary);
  }
  return [...summaries.values()].sort((left, right) => left.platform.localeCompare(right.platform) || left.accountName.localeCompare(right.accountName));
}

function formatCountChange(value: number | null, percent: number | null): string {
  if (value === null) return 'Belum dapat dibandingkan';
  const count = `${value > 0 ? '+' : ''}${formatNumber(value)} pengikut`;
  return percent === null ? count : `${count} (${formatNumber(percent)}%)`;
}

function A4Report({ report, onPreview, onImageResolved }: { report: SocialReportData; onPreview: (image: PreviewImage) => void; onImageResolved: (id: string, failed: boolean) => void }) {
  const publicationSummaries = getPublicationSummaries(report);
  const selectedMonth = report.range.from;
  const periodLabel = formatSocialMonth(selectedMonth.slice(0, 7));

  return <>
    <section className="social-report-page space-y-5 text-xs">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">Laporan Humas & Media Sosial</h1>
        <p className="mt-1">{periodLabel}</p>
        <p className="mt-2 text-[11px]">{formatNumber(report.totals.publications)} publikasi tercatat · {formatNumber(report.totals.accounts)} akun dilaporkan · {formatNumber(report.totals.insight_periods)} arsip insight · {formatNumber(report.totals.evidence_images)} gambar bukti</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Konten yang sudah dipublikasikan</h2>
        <p className="text-ink-subtle">Jumlah ini hanya menghitung publikasi berstatus tercatat pada bulan laporan.</p>
        <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
          <thead><tr className="bg-surface-2"><th className="border-b border-hairline p-2">Akun resmi</th><th className="border-b border-hairline p-2">Jumlah konten</th><th className="border-b border-hairline p-2">Rincian jenis konten</th></tr></thead>
          <tbody>{publicationSummaries.map((summary) => <tr key={summary.accountId}>
            <td className="border-b border-hairline p-2">{summary.accountName}<br /><span className="text-ink-tertiary">{SOCIAL_PLATFORM_LABELS[summary.platform]}</span></td>
            <td className="border-b border-hairline p-2 font-semibold">{formatNumber(summary.total)}</td>
            <td className="border-b border-hairline p-2">{[...summary.contentCounts.entries()].map(([type, count]) => SOCIAL_CONTENT_LABELS[type as keyof typeof SOCIAL_CONTENT_LABELS] + ' ' + formatNumber(count)).join(' · ')}</td>
          </tr>)}{publicationSummaries.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-ink-tertiary">Belum ada publikasi tercatat pada bulan ini.</td></tr>}</tbody>
        </table></div>
      </section>
    </section>

    {report.monthly_growth.length === 0
      ? <section className="social-report-page flex flex-col justify-center space-y-4">
        <h2 className="text-2xl font-semibold">Tren pengikut 12 bulan</h2>
        <SocialMonthlyFollowerTrendChart series={[]} periodLabel={periodLabel} showHeading={false} />
      </section>
      : report.monthly_growth.map((account) => <section key={account.id} className="social-report-page flex flex-col justify-center space-y-5">
        <header>
          <p className="text-sm font-semibold text-primary">Tren pengikut 12 bulan</p>
          <h2 className="mt-2 text-2xl font-semibold">{account.account_name}</h2>
          <p className="mt-1 text-sm text-ink-subtle">{SOCIAL_PLATFORM_LABELS[account.platform]} · Data hingga {periodLabel}</p>
        </header>
        <SocialMonthlyFollowerTrendChart series={[account]} periodLabel={periodLabel} showHeading={false} />
      </section>)}

    <section className="social-report-page space-y-5 text-xs">
      <header>
        <h2 className="text-xl font-semibold">Ringkasan snapshot pengikut</h2>
        <p className="mt-1 text-ink-subtle">Snapshot bulan laporan dan perubahan dibandingkan catatan sebelumnya.</p>
      </header>
      <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
        <thead><tr className="bg-surface-2"><th className="border-b border-hairline p-2">Akun resmi</th><th className="border-b border-hairline p-2">Snapshot bulan laporan</th><th className="border-b border-hairline p-2">Perubahan vs bulan sebelumnya</th></tr></thead>
        <tbody>{report.monthly_growth.map((account) => {
          const point = account.points.find((item) => item.month === selectedMonth);
          return <tr key={account.id}>
            <td className="border-b border-hairline p-2">{account.account_name}<br /><span className="text-ink-tertiary">{SOCIAL_PLATFORM_LABELS[account.platform]}</span></td>
            <td className="border-b border-hairline p-2">{point?.audience_count === null || !point ? 'Belum dicatat' : <>{formatNumber(point.audience_count)} pengikut<br /><span className="text-ink-tertiary">Dicatat {formatDate(point.as_of_date)}</span></>}</td>
            <td className="border-b border-hairline p-2">{formatCountChange(point?.growth_count ?? null, point?.growth_percent ?? null)}{point?.comparison_snapshot && <span className="mt-0.5 block text-ink-tertiary">Dibanding {formatDate(point.comparison_snapshot.as_of_date)} ({formatNumber(point.comparison_snapshot.audience_count)} pengikut)</span>}</td>
          </tr>;
        })}{report.monthly_growth.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-ink-tertiary">Belum ada akun untuk ditampilkan.</td></tr>}</tbody>
      </table></div>
    </section>

    <section className="social-report-page space-y-5 text-xs">
      <header>
        <h2 className="text-xl font-semibold">Daftar publikasi bulan ini</h2>
        <p className="mt-1 text-ink-subtle">{periodLabel}</p>
      </header>
      <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
        <thead><tr className="bg-surface-2"><th className="border-b border-hairline p-2">Tanggal</th><th className="border-b border-hairline p-2">Platform / jenis</th><th className="border-b border-hairline p-2">Uraian</th><th className="border-b border-hairline p-2">Tautan / bukti</th></tr></thead>
        <tbody>{report.publications.map((row) => <tr key={row.id} className="align-top">
          <td className="border-b border-hairline p-2">{formatDate(row.published_at)}</td>
          <td className="border-b border-hairline p-2">{SOCIAL_PLATFORM_LABELS[row.platform]}<br />{SOCIAL_CONTENT_LABELS[row.content_type]}</td>
          <td className="border-b border-hairline p-2 whitespace-pre-wrap">{row.caption}</td>
          <td className="border-b border-hairline p-2">{row.platform_url ? <a className="break-all underline" href={row.platform_url}>{row.platform_url}</a> : 'Tidak ada tautan'}<div className="mt-1">{evidenceFor(row.evidence, 'publication:' + row.id, onPreview, onImageResolved)}</div></td>
        </tr>)}{report.publications.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-ink-tertiary">Belum ada publikasi tercatat pada bulan ini.</td></tr>}</tbody>
      </table></div>
    </section>

    <section className="social-report-page space-y-5 text-xs">
      <header>
        <h2 className="text-xl font-semibold">Ringkasan insight platform</h2>
        <p className="mt-1 text-ink-subtle">Metrik berasal dari arsip insight yang tersimpan; tidak menggantikan hitungan publikasi di atas.</p>
      </header>
      <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
        <thead><tr className="bg-surface-2"><th className="border-b border-hairline p-2">Akun / bulan arsip</th><th className="border-b border-hairline p-2">Platform / sumber</th><th className="border-b border-hairline p-2">Jendela data</th><th className="border-b border-hairline p-2">Metrik yang tercatat</th><th className="border-b border-hairline p-2">Bukti sumber</th></tr></thead>
        <tbody>{report.insight_periods.map((row) => <tr key={row.id} className="align-top">
          <td className="border-b border-hairline p-2">{row.account_name || SOCIAL_PLATFORM_LABELS[row.platform]}<br /><span className="text-ink-tertiary">{row.archive_month ? formatSocialArchiveMonth(row.archive_month) : 'Arsip historis'}</span></td>
          <td className="border-b border-hairline p-2">{SOCIAL_PLATFORM_LABELS[row.platform]}<br /><span className="text-ink-tertiary">{row.archive_month ? getSocialInsightSourceLabel(row.platform) : 'Sumber lama tidak dibedakan'}</span></td>
          <td className="border-b border-hairline p-2">{formatDate(row.period_start)} – {formatDate(row.period_end)}</td>
          <td className="border-b border-hairline p-2">{getSocialInsightMetricEntries(row).length > 0 ? <dl className="grid grid-cols-2 gap-x-3 gap-y-1">{getSocialInsightMetricEntries(row).map(({ key, label, value }) => <div key={key} className="contents"><dt className="text-ink-subtle">{label}</dt><dd className="text-right font-medium">{formatNumber(value)}</dd></div>)}</dl> : 'Tidak tercatat'}</td>
          <td className="border-b border-hairline p-2">{evidenceFor(row.evidence, 'insight:' + row.id, onPreview, onImageResolved, 'h-24 w-36')}{row.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-ink-subtle">{row.notes}</p>}</td>
        </tr>)}{report.insight_periods.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-ink-tertiary">Belum ada arsip insight pada bulan ini.</td></tr>}</tbody>
      </table></div>
    </section>
  </>;
}

function PresentationReport({ report }: { report: SocialReportData }) {
  const periodLabel = formatSocialMonth(report.range.from.slice(0, 7));
  const publicationSummaries = getPublicationSummaries(report);

  return <>
    <section className="social-report-slide flex flex-col justify-center space-y-8 text-center">
      <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Sinegasi Picture</p><h1 className="mt-4 text-4xl font-semibold">Laporan Humas & Media Sosial</h1><p className="mt-3 text-lg">{periodLabel}</p></div>
      <div className="grid grid-cols-2 gap-4 text-left sm:grid-cols-4">
        {([
          ['Publikasi tercatat', report.totals.publications], ['Akun dilaporkan', report.totals.accounts], ['Arsip insight', report.totals.insight_periods], ['Gambar bukti', report.totals.evidence_images],
        ] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-hairline p-5"><p className="text-sm text-ink-subtle">{label}</p><p className="mt-2 text-3xl font-semibold">{formatNumber(value)}</p></div>)}
      </div>
      <p className="text-sm text-ink-subtle">Jumlah publikasi hanya mencakup konten berstatus tercatat pada bulan laporan.</p>
    </section>
    <section className="social-report-slide flex flex-col justify-center space-y-6">
      <header><p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Ringkasan konten</p><h2 className="mt-2 text-3xl font-semibold">Publikasi {periodLabel}</h2></header>
      <div className="space-y-3">{publicationSummaries.length === 0 ? <p className="rounded-xl border border-dashed border-hairline p-5 text-sm text-ink-subtle">Belum ada publikasi tercatat pada bulan ini.</p> : publicationSummaries.map((summary) => <article key={summary.accountId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline p-5"><div><h3 className="font-semibold">{summary.accountName}</h3><p className="text-sm text-ink-subtle">{SOCIAL_PLATFORM_LABELS[summary.platform]} · {[...summary.contentCounts.entries()].map(([type, count]) => `${SOCIAL_CONTENT_LABELS[type as keyof typeof SOCIAL_CONTENT_LABELS]} ${formatNumber(count)}`).join(' · ')}</p></div><p className="text-2xl font-semibold">{formatNumber(summary.total)}<span className="ml-1 text-sm font-normal text-ink-subtle">konten</span></p></article>)}</div>
    </section>
    {report.monthly_growth.length === 0
      ? <section className="social-report-slide flex flex-col justify-center space-y-5"><h2 className="text-3xl font-semibold">Tren pengikut 12 bulan</h2><SocialMonthlyFollowerTrendChart series={[]} periodLabel={periodLabel} showHeading={false} /></section>
      : report.monthly_growth.map((account) => <section key={account.id} className="social-report-slide flex flex-col justify-center space-y-6">
        <header><p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Tren pengikut 12 bulan</p><h2 className="mt-2 text-3xl font-semibold">{account.account_name}</h2><p className="mt-1 text-sm text-ink-subtle">{SOCIAL_PLATFORM_LABELS[account.platform]} · Laporan {periodLabel}</p></header>
        <SocialMonthlyFollowerTrendChart series={[account]} periodLabel={periodLabel} showHeading={false} />
      </section>)}
  </>;
}

export function SocialReportDialog({ open, onOpenChange, report, isLoading, error, onRetry, onPrint }: SocialReportDialogProps) {
  const [format, setFormat] = useState<ReportPrintFormat>('a4');
  const [preview, setPreview] = useState<PreviewImage | null>(null);
  const [resolved, setResolved] = useState<{ signature: string; ids: Set<string>; failures: Set<string> }>({ signature: '', ids: new Set(), failures: new Set() });
  const images = useMemo(() => report ? signedImages(report) : [], [report]);
  const signature = images.map((image) => `${image.id}:${image.src}`).join('|');
  const imageState = resolved.signature === signature ? resolved : { signature, ids: new Set<string>(), failures: new Set<string>() };
  const allImagesReady = images.every((image) => imageState.ids.has(image.id));
  const hasImageFailures = imageState.failures.size > 0;
  const hasMissingImages = Boolean(report && missingImageCount(report) > 0);
  const isComplete = report?.complete === true && report.truncated === false;
  const canPrint = Boolean(report && isComplete && !isLoading && !error && (format !== 'a4' || (allImagesReady && !hasImageFailures && !hasMissingImages)));

  const markImage = (id: string, failed: boolean) => setResolved((current) => {
    const base = current.signature === signature ? current : { signature, ids: new Set<string>(), failures: new Set<string>() };
    const ids = new Set(base.ids); ids.add(id);
    const failures = new Set(base.failures);
    if (failed) failures.add(id); else failures.delete(id);
    return { signature, ids, failures };
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setFormat('a4');
    if (!nextOpen) setPreview(null);
    onOpenChange(nextOpen);
  };

  return <>
    <ReportPreviewDialog
      dialog={{ open, onOpenChange: handleOpenChange }}
      document={{ format, a4Orientation: 'landscape', title: 'Laporan Humas & Media Sosial', description: 'Periksa jumlah publikasi, grafik pertumbuhan bulanan, dan metrik insight sebelum mencetak.', screenOnlyClass: 'social-report-screen-only', pageClass: 'social-report-page', slideClass: 'social-report-slide' }}
      actions={{ onPrint: () => onPrint(format), disabled: !canPrint }}
    >
      <div id="social-report-print" className="space-y-4">
        <div className="social-report-screen-only flex items-center justify-end"><ReportFormatSelector name="social-media-report-format" value={format} onValueChange={setFormat} legend="Format laporan" /></div>
        {isLoading && <DataTableSkeleton columns={5} rows={5} label="Menyiapkan laporan Humas..." />}
        {!isLoading && Boolean(error) && <QueryErrorState title="Laporan belum dapat dimuat" error={error} onRetry={onRetry} />}
        {!isLoading && !error && report && !isComplete && <div role="alert" className="rounded-lg border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-sm text-semantic-danger">Laporan bulanan belum lengkap atau terpotong. Muat ulang; pencetakan dinonaktifkan agar data tidak hilang.</div>}
        {!isLoading && !error && report && isComplete && <>
          {format === 'a4' ? <A4Report report={report} onPreview={setPreview} onImageResolved={markImage} /> : <PresentationReport report={report} />}
          {format === 'a4' && images.length > 0 && !allImagesReady && <p className="social-report-screen-only text-center text-xs text-ink-tertiary" role="status">Memuat {imageState.ids.size} dari {images.length} gambar bukti sebelum cetak...</p>}
          {hasImageFailures && <div className="social-report-screen-only flex flex-col items-center gap-2 rounded-lg border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-center text-sm text-semantic-danger"><p>{imageState.failures.size} gambar bukti gagal dimuat. Cetak dinonaktifkan agar lampiran tidak hilang.</p><button type="button" onClick={onRetry} className="min-h-11 underline underline-offset-2">Muat ulang laporan dan tautan bukti</button></div>}
          {hasMissingImages && <p role="alert" className="social-report-screen-only rounded-lg border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-sm text-semantic-danger">{missingImageCount(report)} bukti terlampir tidak memiliki tautan akses. Pencetakan A4 dinonaktifkan supaya lampiran tidak hilang.</p>}
          {format === 'presentation' && <p className="social-report-screen-only text-center text-xs text-ink-tertiary">Presentasi menampilkan ringkasan publikasi dan grafik per akun; gunakan A4 untuk mencetak seluruh baris data dan bukti.</p>}
        </>}
      </div>
    </ReportPreviewDialog>
    <ImagePreviewDialog open={Boolean(preview)} onOpenChange={(nextOpen) => { if (!nextOpen) setPreview(null); }} src={preview?.src ?? null} alt={preview?.alt ?? 'Pratinjau bukti laporan'} title={preview?.label ?? 'Bukti laporan'} description={preview?.alt} />
  </>;
}
