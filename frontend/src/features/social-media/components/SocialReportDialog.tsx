import { useMemo, useState } from 'react';
import { DataTableSkeleton } from '@/shared/ui/LoadingSkeletons';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { ImagePreviewDialog } from '@/shared/ui/ImagePreviewDialog';
import { ReportFormatSelector } from '@/shared/ui/report/ReportFormatSelector';
import { ReportPreviewDialog } from '@/shared/ui/report/ReportPreviewDialog';
import type { ReportPrintFormat } from '@/shared/types/report';
import type { SocialEvidence, SocialReportActivity, SocialReportData } from '../types/socialMedia.types';
import { formatSocialDateRange } from '../utils/socialMediaDates';

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
  for (const activity of report.activities) {
    const activityEvidence = activity.evidence ?? [];
    if (activityEvidence.length === 0 && activity.photo_access_url) images.push({ id: `activity:${activity.id}`, src: activity.photo_access_url, alt: `Dokumentasi ${activity.activity_name}`, label: 'Foto kegiatan' });
    for (const evidence of activityEvidence) {
      if (evidence.access_url) images.push({ id: `activity:${activity.id}:${evidence.id}`, src: evidence.access_url, alt: `Bukti kegiatan ${activity.activity_name}`, label: 'Bukti kegiatan' });
    }
  }
  for (const publication of report.publications) {
    for (const evidence of publication.evidence ?? []) {
      if (evidence.access_url) images.push({ id: `publication:${publication.id}:${evidence.id}`, src: evidence.access_url, alt: `Bukti ${publication.caption}`, label: 'Bukti publikasi' });
    }
  }
  for (const period of report.insight_periods) {
    for (const evidence of period.evidence ?? []) {
      if (evidence.access_url) images.push({ id: `insight:${period.id}:${evidence.id}`, src: evidence.access_url, alt: `Grafik ${period.platform} ${period.period_start}–${period.period_end}`, label: 'Grafik insight' });
    }
  }
  return images;
}

function missingImageCount(report: SocialReportData): number {
  return report.activities.reduce((count, activity) => count + (activity.evidence ?? []).filter((item) => item.upload_status !== 'abandoned' && !item.access_url).length, 0)
    + report.publications.reduce((count, publication) => count + publication.evidence.filter((item) => item.upload_status !== 'abandoned' && !item.access_url).length, 0)
    + report.insight_periods.reduce((count, period) => count + period.evidence.filter((item) => item.upload_status !== 'abandoned' && !item.access_url).length, 0);
}

function evidenceFor(evidence: SocialEvidence[] | undefined, parentId: string, onPreview: (image: PreviewImage) => void, onImageResolved: (id: string, failed: boolean) => void) {
  if (!evidence?.length) return <span className="text-ink-tertiary">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {evidence.map((item) => item.access_url ? (
        <button key={item.id} type="button" onClick={() => onPreview({ id: `${parentId}:${item.id}`, src: item.access_url as string, alt: item.original_filename, label: 'Bukti laporan' })} className="rounded border border-hairline bg-white p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Pratinjau ${item.original_filename}`}>
          <img src={item.access_url} alt={item.original_filename} className="h-12 w-16 object-contain" loading="eager" referrerPolicy="no-referrer" onLoad={() => onImageResolved(`${parentId}:${item.id}`, false)} onError={() => onImageResolved(`${parentId}:${item.id}`, true)} />
        </button>
      ) : (
        <span key={item.id} className="rounded border border-semantic-danger/40 px-2 py-1 text-[10px] text-semantic-danger">Bukti tidak memiliki tautan akses</span>
      ))}
    </div>
  );
}

function formatDate(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

function formatSnapshotGrowth(snapshot: { growth_count: number | null; growth_percent: number | null }): string {
  if (snapshot.growth_count === null) return 'Baseline';
  const delta = `${snapshot.growth_count > 0 ? '+' : ''}${snapshot.growth_count.toLocaleString('id-ID')}`;
  return snapshot.growth_percent === null ? delta : `${delta} (${snapshot.growth_percent}%)`;
}

function activityEvidence(activity: SocialReportActivity, onPreview: (image: PreviewImage) => void, onImageResolved: (id: string, failed: boolean) => void) {
  if (activity.evidence?.length) return evidenceFor(activity.evidence, `activity:${activity.id}`, onPreview, onImageResolved);
  if (!activity.photo_access_url) return '—';
  return <button type="button" onClick={() => onPreview({ id: `activity:${activity.id}`, src: activity.photo_access_url as string, alt: `Dokumentasi ${activity.activity_name}`, label: 'Foto kegiatan' })} className="rounded border border-hairline p-1"><img src={activity.photo_access_url} alt={`Dokumentasi ${activity.activity_name}`} className="h-12 w-16 object-contain" loading="eager" referrerPolicy="no-referrer" onLoad={() => onImageResolved(`activity:${activity.id}`, false)} onError={() => onImageResolved(`activity:${activity.id}`, true)} /></button>;
}

function A4Report({ report, onPreview, onImageResolved }: { report: SocialReportData; onPreview: (image: PreviewImage) => void; onImageResolved: (id: string, failed: boolean) => void }) {
  return (
    <section className="social-report-page space-y-5 text-xs">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">Laporan Humas & Media Sosial</h1>
        <p className="mt-1">{formatSocialDateRange(report.range)}</p>
        <p className="mt-2 text-[11px]">{report.totals.activities} kegiatan · {report.totals.publications} publikasi · {report.totals.snapshots} catatan pengikut · {report.totals.insight_periods} insight · {report.totals.evidence_images} gambar bukti</p>
      </header>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Kegiatan SP</h2>
        <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
          <thead><tr className="bg-surface-2"><th className="border-b border-hairline p-2">Tanggal</th><th className="border-b border-hairline p-2">Kegiatan</th><th className="border-b border-hairline p-2">Pelaksana / PIC</th><th className="border-b border-hairline p-2">Dokumentasi</th></tr></thead>
          <tbody>{report.activities.map((row: SocialReportActivity) => <tr key={row.id} className="align-top">
            <td className="border-b border-hairline p-2">{formatDate(row.activity_date)}</td>
            <td className="border-b border-hairline p-2"><p className="font-semibold">{row.activity_name}</p><p className="mt-1 whitespace-pre-wrap">{row.activity_description}</p></td>
            <td className="border-b border-hairline p-2">{row.instructor_name || '—'}{row.pic_names?.length ? <p className="mt-1">{row.pic_names.join(', ')}</p> : null}</td>
            <td className="border-b border-hairline p-2">{activityEvidence(row, onPreview, onImageResolved)}</td>
          </tr>)}{report.activities.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-ink-tertiary">Tidak ada kegiatan pada rentang ini.</td></tr>}</tbody>
        </table></div>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Publikasi konten</h2>
        <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
          <thead><tr className="bg-surface-2"><th className="border-b border-hairline p-2">Tanggal</th><th className="border-b border-hairline p-2">Platform / jenis</th><th className="border-b border-hairline p-2">Uraian</th><th className="border-b border-hairline p-2">Tautan / bukti</th><th className="border-b border-hairline p-2">Agenda</th></tr></thead>
          <tbody>{report.publications.map((row) => <tr key={row.id} className="align-top">
            <td className="border-b border-hairline p-2">{formatDate(row.published_at)}</td>
            <td className="border-b border-hairline p-2">{row.platform}<br />{row.content_type}</td>
            <td className="border-b border-hairline p-2 whitespace-pre-wrap">{row.caption}</td>
            <td className="border-b border-hairline p-2">{row.platform_url ? <a className="break-all underline" href={row.platform_url}>{row.platform_url}</a> : '—'}<div className="mt-1">{evidenceFor(row.evidence, `publication:${row.id}`, onPreview, onImageResolved)}</div></td>
            <td className="border-b border-hairline p-2">{row.agenda_activity_id ?? '—'}</td>
          </tr>)}{report.publications.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-ink-tertiary">Tidak ada publikasi pada rentang ini.</td></tr>}</tbody>
        </table></div>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Pertumbuhan akun</h2>
        <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
          <thead><tr className="bg-surface-2"><th className="border-b border-hairline p-2">Akun / tanggal</th><th className="border-b border-hairline p-2">Jumlah pengikut</th><th className="border-b border-hairline p-2">Pertumbuhan</th></tr></thead>
          <tbody>{report.snapshots.map((row) => <tr key={row.id}>
            <td className="border-b border-hairline p-2">{row.platform} · {formatDate(row.as_of_date)}</td><td className="border-b border-hairline p-2">{row.audience_count.toLocaleString('id-ID')}</td><td className="border-b border-hairline p-2">{formatSnapshotGrowth(row)}</td>
          </tr>)}{report.snapshots.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-ink-tertiary">Tidak ada catatan pengikut pada rentang ini.</td></tr>}</tbody>
        </table></div>
        <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
          <thead><tr className="bg-surface-2"><th className="border-b border-hairline p-2">Akun / periode</th><th className="border-b border-hairline p-2">Views</th><th className="border-b border-hairline p-2">Jangkauan</th><th className="border-b border-hairline p-2">Interaksi</th><th className="border-b border-hairline p-2">Unggahan grafik</th></tr></thead>
          <tbody>{report.insight_periods.map((row) => <tr key={row.id} className="align-top">
            <td className="border-b border-hairline p-2">{row.platform}<br />{formatDate(row.period_start)} – {formatDate(row.period_end)}</td><td className="border-b border-hairline p-2">{row.views?.toLocaleString('id-ID') ?? '—'}</td><td className="border-b border-hairline p-2">{row.reach?.toLocaleString('id-ID') ?? '—'}</td><td className="border-b border-hairline p-2">{row.interactions?.toLocaleString('id-ID') ?? '—'}</td><td className="border-b border-hairline p-2">{evidenceFor(row.evidence, `insight:${row.id}`, onPreview, onImageResolved)}</td>
          </tr>)}{report.insight_periods.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-ink-tertiary">Tidak ada insight pada rentang ini.</td></tr>}</tbody>
        </table></div>
      </section>
    </section>
  );
}

function PresentationReport({ report }: { report: SocialReportData }) {
  return <section className="social-report-slide flex flex-col justify-center space-y-8 text-center">
    <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Sinegasi Picture</p><h1 className="mt-4 text-4xl font-semibold">Laporan Humas & Media Sosial</h1><p className="mt-3 text-lg">{formatSocialDateRange(report.range)}</p></div>
    <div className="grid grid-cols-2 gap-4 text-left sm:grid-cols-5">
      {([
        ['Kegiatan', report.totals.activities], ['Publikasi', report.totals.publications], ['Catatan pengikut', report.totals.snapshots], ['Insight akun', report.totals.insight_periods], ['Gambar bukti', report.totals.evidence_images],
      ] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-hairline p-5"><p className="text-sm text-ink-subtle">{label}</p><p className="mt-2 text-3xl font-semibold">{value.toLocaleString('id-ID')}</p></div>)}
    </div>
    <p className="text-sm text-ink-subtle">Rincian lengkap tersedia pada format A4.</p>
  </section>;
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
      document={{ format, a4Orientation: 'landscape', title: 'Laporan Humas & Media Sosial', description: 'Periksa kelengkapan kegiatan, publikasi, dan pertumbuhan sebelum mencetak.', screenOnlyClass: 'social-report-screen-only', pageClass: 'social-report-page', slideClass: 'social-report-slide' }}
      actions={{ onPrint: () => onPrint(format), disabled: !canPrint }}
    >
      <div id="social-report-print" className="space-y-4">
        <div className="social-report-screen-only flex items-center justify-end"><ReportFormatSelector name="social-media-report-format" value={format} onValueChange={setFormat} legend="Format laporan" /></div>
        {isLoading && <DataTableSkeleton columns={5} rows={5} label="Menyiapkan laporan Humas..." />}
        {!isLoading && Boolean(error) && <QueryErrorState title="Laporan belum dapat dimuat" error={error} onRetry={onRetry} />}
        {!isLoading && !error && report && !isComplete && <div role="alert" className="rounded-lg border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-sm text-semantic-danger">Laporan belum lengkap atau terpotong. Persempit rentang tanggal lalu muat ulang; pencetakan dinonaktifkan agar data tidak hilang.</div>}
        {!isLoading && !error && report && isComplete && <>
          {format === 'a4' ? <A4Report report={report} onPreview={setPreview} onImageResolved={markImage} /> : <PresentationReport report={report} />}
          {format === 'a4' && images.length > 0 && !allImagesReady && <p className="social-report-screen-only text-center text-xs text-ink-tertiary" role="status">Memuat {imageState.ids.size} dari {images.length} gambar bukti sebelum cetak...</p>}
          {hasImageFailures && <div className="social-report-screen-only flex flex-col items-center gap-2 rounded-lg border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-center text-sm text-semantic-danger"><p>{imageState.failures.size} gambar bukti gagal dimuat. Cetak dinonaktifkan agar lampiran tidak hilang.</p><button type="button" onClick={onRetry} className="min-h-11 underline underline-offset-2">Muat ulang laporan dan tautan bukti</button></div>}
          {hasMissingImages && <p role="alert" className="social-report-screen-only rounded-lg border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-sm text-semantic-danger">{missingImageCount(report)} bukti terlampir tidak memiliki tautan akses. Pencetakan A4 dinonaktifkan supaya laporan tidak tampak lengkap padahal ada bukti yang hilang.</p>}
          {format === 'presentation' && <p className="social-report-screen-only text-center text-xs text-ink-tertiary">Presentasi mencetak ringkasan; gunakan A4 untuk mencetak seluruh baris data dan bukti.</p>}
        </>}
      </div>
    </ReportPreviewDialog>
    <ImagePreviewDialog open={Boolean(preview)} onOpenChange={(nextOpen) => { if (!nextOpen) setPreview(null); }} src={preview?.src ?? null} alt={preview?.alt ?? 'Pratinjau bukti laporan'} title={preview?.label ?? 'Bukti laporan'} description={preview?.alt} />
  </>;
}
