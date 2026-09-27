import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { DataTableSkeleton } from '@/shared/ui/LoadingSkeletons';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { ImagePreviewDialog } from '@/shared/ui/ImagePreviewDialog';
import { ReportFormatSelector } from '@/shared/ui/report/ReportFormatSelector';
import { ReportPreviewDialog } from '@/shared/ui/report/ReportPreviewDialog';
import type { ReportPrintFormat } from '@/shared/types/report';
import type { AgendaReportActivity } from '../types/agenda.types';

interface AgendaReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: AgendaReportActivity[];
  periodLabel: string;
  isLoading: boolean;
  error?: unknown;
  truncated?: boolean;
  onRetry: () => void;
  onPrint: (format: ReportPrintFormat) => void;
}

interface PhotoPreview {
  src: string;
  alt: string;
  title: string;
  description?: string;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

function PhotoCell({ row, onResolved, onPreview }: { row: AgendaReportActivity; onResolved: (id: string) => void; onPreview: (preview: PhotoPreview) => void }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = row.photo_access_url;

  if (!row.photo || !photoUrl || failed) return <span className="text-ink-tertiary">-</span>;

  return (
    <button
      type="button"
      className="agenda-report-photo-button block min-h-11 min-w-11 rounded-md border border-hairline bg-surface-2 p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={() => onPreview({ src: photoUrl, alt: `Dokumentasi ${row.activity_name}`, title: 'Foto dokumentasi agenda', description: row.photo?.original_filename })}
      aria-label={`Lihat foto dokumentasi ${row.activity_name}`}
    >
      <img
        src={photoUrl}
        alt={`Dokumentasi ${row.activity_name}`}
        className="h-16 w-24 rounded object-cover"
        loading="eager"
        referrerPolicy="no-referrer"
        onLoad={() => onResolved(row.id)}
        onError={() => {
          setFailed(true);
          onResolved(row.id);
        }}
      />
    </button>
  );
}

function A4Document({ rows, periodLabel, truncated, onResolved, onPreview }: { rows: AgendaReportActivity[]; periodLabel: string; truncated?: boolean; onResolved: (id: string) => void; onPreview: (preview: PhotoPreview) => void }) {
  return (
    <section className="agenda-report-page space-y-5">
      <header className="text-center">
        <h1 className="text-2xl font-semibold leading-snug tracking-[-0.01em]">{periodLabel}</h1>
        <p className="mt-1 text-sm text-ink-subtle">Agenda kegiatan ekstrakurikuler</p>
      </header>
      {truncated && <p className="agenda-report-screen-only text-center text-xs text-ink-tertiary">Menampilkan maksimal 100 agenda terbaru.</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-surface-2 text-left">
              <th scope="col" className="w-12 border-b border-hairline px-2 py-2.5">No</th>
              <th scope="col" className="border-b border-hairline px-2 py-2.5">Uraian Kegiatan</th>
              <th scope="col" className="w-32 border-b border-hairline px-2 py-2.5">Waktu Terlaksana</th>
              <th scope="col" className="w-36 border-b border-hairline px-2 py-2.5">Pengajar</th>
              <th scope="col" className="w-40 border-b border-hairline px-2 py-2.5">PIC</th>
              <th scope="col" className="w-28 border-b border-hairline px-2 py-2.5">Foto</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-2 py-8 text-center text-ink-tertiary">Tidak ada agenda pada rentang ini.</td></tr>}
            {rows.map((row, index) => (
              <tr key={row.id} className="align-top">
                <td className="border-b border-hairline px-2 py-2.5 text-ink-subtle">{index + 1}</td>
                <td className="border-b border-hairline px-2 py-2.5">
                  <p className="font-semibold">{row.activity_name}</p>
                  <p className="mt-1 whitespace-pre-wrap text-ink-subtle">{row.activity_description}</p>
                </td>
                <td className="border-b border-hairline px-2 py-2.5 text-ink-subtle">{formatDate(row.activity_date)}</td>
                <td className="border-b border-hairline px-2 py-2.5">{row.instructor_name || '—'}</td>
                <td className="border-b border-hairline px-2 py-2.5">{row.pic_names.join(', ')}</td>
                <td className="border-b border-hairline px-2 py-2.5"><PhotoCell row={row} onResolved={onResolved} onPreview={onPreview} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PresentationPhoto({ row, onResolved, onPreview }: { row: AgendaReportActivity; onResolved: (id: string) => void; onPreview: (preview: PhotoPreview) => void }) {
  const [failed, setFailed] = useState(false);

  if (!row.photo_access_url || failed) {
    return <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-base text-ink-tertiary">Tidak ada foto dokumentasi</div>;
  }

  return (
    <button
      type="button"
      className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={() => onPreview({ src: row.photo_access_url as string, alt: `Dokumentasi ${row.activity_name}`, title: 'Foto dokumentasi agenda', description: row.photo?.original_filename })}
      aria-label={`Lihat foto dokumentasi ${row.activity_name}`}
    >
      <img
        src={row.photo_access_url}
        alt={`Dokumentasi ${row.activity_name}`}
        className="h-full w-full object-cover"
        loading="eager"
        referrerPolicy="no-referrer"
        onLoad={() => onResolved(row.id)}
        onError={() => {
          setFailed(true);
          onResolved(row.id);
        }}
      />
    </button>
  );
}

function PresentationDocument({ rows, periodLabel, onResolved, onPreview }: { rows: AgendaReportActivity[]; periodLabel: string; onResolved: (id: string) => void; onPreview: (preview: PhotoPreview) => void }) {
  return (
    <div className="space-y-4">
      <section className="agenda-report-slide flex flex-col items-center justify-center rounded-xl bg-surface-1 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary">Agenda kegiatan</p>
        <h1 className="mt-3 text-4xl font-semibold leading-none tracking-[-0.02em]">{periodLabel}</h1>
        <p className="mt-4 text-lg text-ink-subtle">Kegiatan ekstrakurikuler yang sudah terlaksana</p>
        <p className="mt-6 text-sm text-ink-tertiary">{rows.length} kegiatan tercatat</p>
      </section>
      {rows.length === 0 && (
        <section className="agenda-report-slide flex flex-col items-center justify-center rounded-xl bg-surface-1 text-center">
          <ImageIcon size={40} className="text-ink-tertiary" aria-hidden="true" />
          <p className="mt-4 text-xl font-semibold">Belum ada agenda kegiatan</p>
          <p className="mt-2 text-base text-ink-subtle">Tidak ada data pada rentang yang dipilih.</p>
        </section>
      )}
      {rows.map((row) => (
        <section key={row.id} className="agenda-report-slide grid grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-8 rounded-xl bg-surface-1">
          <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
            <PresentationPhoto row={row} onResolved={onResolved} onPreview={onPreview} />
          </div>
          <div className="flex min-h-0 flex-col justify-center">
            <p className="text-base font-medium text-primary">{formatDate(row.activity_date)}</p>
            <h2 className="mt-3 text-3xl font-semibold leading-snug tracking-[-0.01em]">{row.activity_name}</h2>
            <p className="mt-4 max-h-32 overflow-hidden whitespace-pre-wrap text-lg leading-normal text-ink-subtle">{row.activity_description}</p>
            <dl className="mt-6 grid gap-4 text-base sm:grid-cols-2">
              <div><dt className="text-ink-tertiary">Pengajar</dt><dd className="mt-1 font-semibold">{row.instructor_name || '—'}</dd></div>
              <div><dt className="text-ink-tertiary">PIC/BPH</dt><dd className="mt-1 font-semibold">{row.pic_names.join(', ')}</dd></div>
            </dl>
          </div>
        </section>
      ))}
    </div>
  );
}

export function AgendaReportDialog({ open, onOpenChange, rows, periodLabel, isLoading, error, truncated, onRetry, onPrint }: AgendaReportDialogProps) {
  const [format, setFormat] = useState<ReportPrintFormat>('a4');
  const [resolvedPhotos, setResolvedPhotos] = useState<{ signature: string; ids: Set<string> }>({ signature: '', ids: new Set() });
  const [preview, setPreview] = useState<PhotoPreview | null>(null);

  const reportSignature = rows.map((row) => `${row.id}:${row.photo_access_url ?? ''}`).join('|');
  const immediatelyResolved = new Set(rows.filter((row) => !row.photo_access_url).map((row) => row.id));
  const resolvedPhotoIds = resolvedPhotos.signature === reportSignature ? resolvedPhotos.ids : immediatelyResolved;

  const resolvePhoto = (id: string) => setResolvedPhotos((current) => {
    const base = current.signature === reportSignature ? current.ids : immediatelyResolved;
    if (base.has(id)) return current;
    const next = new Set(base);
    next.add(id);
    return { signature: reportSignature, ids: next };
  });

  const photoRows = rows.filter((row) => row.photo_access_url);
  const photosReady = photoRows.every((row) => resolvedPhotoIds.has(row.id));
  const canPrint = !isLoading && !error && rows.length > 0 && photosReady;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setFormat('a4');
    if (!nextOpen) setPreview(null);
    onOpenChange(nextOpen);
  };

  return (
    <>
      <ReportPreviewDialog
        dialog={{ open, onOpenChange: handleOpenChange }}
        document={{
          format,
          a4Orientation: 'landscape',
          title: 'Laporan agenda kegiatan',
          description: 'Periksa laporan sebelum mencetak atau menyimpan PDF.',
          screenOnlyClass: 'agenda-report-screen-only',
          pageClass: 'agenda-report-page',
          slideClass: 'agenda-report-slide',
        }}
        actions={{ onPrint: () => onPrint(format), disabled: !canPrint }}
      >
        <div id="agenda-report-print" className="space-y-4">
          <div className="agenda-report-screen-only flex items-center justify-end">
            <ReportFormatSelector name="agenda-report-format" value={format} onValueChange={setFormat} legend="Format laporan" />
          </div>
          {isLoading && <DataTableSkeleton columns={6} rows={6} label="Menyiapkan laporan agenda..." />}
          {!isLoading && Boolean(error) && <QueryErrorState title="Laporan agenda belum dapat dimuat" error={error} onRetry={onRetry} />}
          {!isLoading && !error && (format === 'a4' ? <A4Document rows={rows} periodLabel={periodLabel} truncated={truncated} onResolved={resolvePhoto} onPreview={setPreview} /> : <PresentationDocument rows={rows} periodLabel={periodLabel} onResolved={resolvePhoto} onPreview={setPreview} />)}
          {!isLoading && !error && rows.length > 0 && !photosReady && <p className="agenda-report-screen-only text-center text-xs text-ink-tertiary" role="status">Menyiapkan foto dokumentasi sebelum laporan dapat dicetak...</p>}
        </div>
      </ReportPreviewDialog>
      <ImagePreviewDialog
        open={Boolean(preview)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setPreview(null); }}
        src={preview?.src ?? null}
        alt={preview?.alt ?? 'Pratinjau foto agenda'}
        title={preview?.title ?? 'Foto dokumentasi agenda'}
        description={preview?.description}
      />
    </>
  );
}
