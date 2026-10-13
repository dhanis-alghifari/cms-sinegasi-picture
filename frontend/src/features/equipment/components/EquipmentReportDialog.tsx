import { useMemo, useState } from 'react';
import { PrivateImage } from '@/shared/ui/PrivateImage';
import { Printer, RefreshCcw, X } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { ReportPrintFormat } from '@/shared/types/report';
import { ReportFormatSelector } from '@/shared/ui/report/ReportFormatSelector';
import { useEquipmentReportQuery } from '../hooks/useEquipmentQuery';
import type { EquipmentReport, EquipmentReportItem, EquipmentReportParams } from '../types/equipment.types';
import { printEquipmentReport } from '../utils/printEquipmentReport';
import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent } from '@/shared/ui/primitives/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { RadioGroup } from '@/shared/ui/primitives/radio-group';
import { UI_CONSTANTS } from '@/shared/constants/ui';

type ReportScope = 'all' | 'filtered';

interface EquipmentReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search?: string;
  kategori?: EquipmentReportParams['kategori'];
  kondisi?: EquipmentReportParams['kondisi'];
  status?: EquipmentReportParams['status'];
}

const categoryLabels: Record<EquipmentReportItem['category'], string> = {
  camera: 'Kamera',
  lens: 'Lensa',
  audio: 'Audio',
  lighting: 'Lighting',
  accessory: 'Aksesoris',
  other: 'Lainnya',
};

const conditionLabels: Record<EquipmentReportItem['condition'], string> = {
  good: 'Bagus',
  minor_damage: 'Sedikit rusak',
  damaged: 'Rusak',
  severely_damaged: 'Rusak berat',
  under_repair: 'Sedang diperbaiki',
  lost: 'Hilang',
};

const availabilityLabels: Record<EquipmentReportItem['availability_status'], string> = {
  available: 'Tersedia',
  borrowed: 'Dipinjam',
  maintenance: 'Maintenance',
};

function reportScopeLabel(scope: EquipmentReport['meta']['filters']['scope']): string {
  return scope === UI_CONSTANTS.ALL_FILTER_VALUE ? 'Semua alat' : 'Mengikuti filter halaman';
}

function formatEquipmentValue(value?: number): string {
  return typeof value === 'number' && value > 0 ? formatCurrency(value) : '-';
}

function getConditionClass(condition: EquipmentReportItem['condition']): string {
  if (condition === 'good') return 'text-semantic-success';
  if (condition === 'lost') return 'text-semantic-danger';
  return 'text-semantic-warning';
}

function Metric({ label, value, tone = 'text-ink' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-2 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight ${tone}`}>{formatNumber(value)}</p>
    </div>
  );
}

function SummaryMetrics({ report }: { report: EquipmentReport }) {
  const { summary } = report;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
      <Metric label="Total alat" value={summary.total_units} />
      <Metric label="Tersedia" value={summary.available_units} tone="text-semantic-success" />
      <Metric label="Dipinjam" value={summary.borrowed_units} tone="text-primary" />
      <Metric label="Maintenance" value={summary.maintenance_units} tone="text-semantic-warning" />
      <Metric label="Rusak" value={summary.damaged_units} tone="text-semantic-danger" />
      <Metric label="Hilang" value={summary.lost_units} tone="text-semantic-danger" />
    </div>
  );
}

function ReportHeading({ report, title = 'Ringkasan inventaris alat' }: { report: EquipmentReport; title?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Sinegasi CMS</p>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="text-xs text-ink-subtle">Data per {formatDateShort(report.meta.generated_at)} · {reportScopeLabel(report.meta.filters.scope)}</p>
    </div>
  );
}

function ReportTable({ items }: { items: EquipmentReportItem[] }) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-dashed border-hairline px-3 py-6 text-center text-xs text-ink-tertiary">Tidak ada alat dalam laporan.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-hairline">
      <table className="min-w-[720px] w-full text-xs">
        <thead className="bg-surface-2 text-left text-[10px] uppercase tracking-wide text-ink-tertiary">
          <tr>
            <th className="px-2 py-2">Alat</th>
            <th className="px-2 py-2">Kategori</th>
            <th className="px-2 py-2">Kondisi terakhir</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2 text-right">Nilai alat</th>
            <th className="px-2 py-2">Lokasi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="px-2 py-2">
                <p className="font-mono font-semibold text-ink">{item.equipment_code}</p>
                <p className="mt-0.5 text-ink-subtle">{item.name}</p>
              </td>
              <td className="px-2 py-2 text-ink-subtle">{categoryLabels[item.category]}</td>
              <td className={`px-2 py-2 ${getConditionClass(item.condition)}`}>
                {conditionLabels[item.condition]}
              </td>
              <td className="px-2 py-2 text-ink-subtle">
                {availabilityLabels[item.availability_status]}
                {item.reservation_status === 'reserved' ? ' · Dipesan' : ''}
              </td>
              <td className="px-2 py-2 text-right font-mono text-ink-subtle">
                {formatEquipmentValue(item.replacement_value)}
              </td>
              <td className="px-2 py-2 text-ink-subtle">{item.storage_location || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PhotoGallery({ items }: { items: EquipmentReportItem[] }) {
  const photoItems = items.filter((item) => item.photo_urls?.[0]);
  if (photoItems.length === 0) {
    return <p className="rounded-lg border border-dashed border-hairline px-3 py-6 text-center text-xs text-ink-tertiary">Belum ada foto alat dalam laporan.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {photoItems.map((item) => (
        <figure key={item.id} className="space-y-1.5">
          <PrivateImage src={`/api/equipment/${item.id}/photo`} alt={`Foto ${item.name}`} className="aspect-[4/3] w-full rounded-lg object-cover" loading="eager" />
          <figcaption className="text-xs text-ink-subtle">
            <span className="font-mono font-semibold text-ink">{item.equipment_code}</span> · {item.name}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function A4Document({ report, includePhotos }: { report: EquipmentReport; includePhotos: boolean }) {
  return (
    <div className="space-y-4">
      <section className="equipment-report-a4-page space-y-5">
        <ReportHeading report={report} />
        <SummaryMetrics report={report} />
      </section>
      <section className="equipment-report-a4-page space-y-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Daftar inventaris</h2>
          <p className="text-xs text-ink-subtle">{formatNumber(report.items.length)} alat dengan kondisi, status, dan nilai terbaru.</p>
        </div>
        <ReportTable items={report.items} />
      </section>
      {includePhotos && (
        <section className="equipment-report-a4-page space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Foto alat</h2>
            <p className="text-xs text-ink-subtle">Foto terbaru yang tersimpan untuk setiap alat.</p>
          </div>
          <PhotoGallery items={report.items} />
        </section>
      )}
    </div>
  );
}

function PresentationDocument({ report, includePhotos }: { report: EquipmentReport; includePhotos: boolean }) {
  const itemSlides = Array.from(
    { length: Math.ceil(report.items.length / 8) || 1 },
    (_, index) => report.items.slice(index * 8, index * 8 + 8),
  );
  const photoItems = report.items.filter((item) => item.photo_urls?.[0]);
  const photoSlides = Array.from(
    { length: Math.ceil(photoItems.length / 4) },
    (_, index) => photoItems.slice(index * 4, index * 4 + 4),
  );

  return (
    <div className="space-y-4">
      <section className="equipment-report-slide flex flex-col justify-center space-y-5 rounded-xl bg-surface-1">
        <ReportHeading report={report} />
        <SummaryMetrics report={report} />
      </section>
      {itemSlides.map((items, index) => (
        <section key={`items-${index}`} className="equipment-report-slide space-y-4 rounded-xl bg-surface-1">
          <div>
            <h2 className="text-xl font-semibold text-ink">Daftar inventaris</h2>
            <p className="text-xs text-ink-subtle">Halaman {index + 1} dari {itemSlides.length} · {formatNumber(items.length)} alat</p>
          </div>
          <ReportTable items={items} />
        </section>
      ))}
      {includePhotos && (photoSlides.length > 0 ? photoSlides.map((items, index) => (
        <section key={`photos-${index}`} className="equipment-report-slide space-y-4 rounded-xl bg-surface-1">
          <div>
            <h2 className="text-xl font-semibold text-ink">Foto alat</h2>
            <p className="text-xs text-ink-subtle">Halaman {index + 1} dari {photoSlides.length}</p>
          </div>
          <PhotoGallery items={items} />
        </section>
      )) : (
        <section className="equipment-report-slide space-y-4 rounded-xl bg-surface-1">
          <h2 className="text-xl font-semibold text-ink">Foto alat</h2>
          <PhotoGallery items={[]} />
        </section>
      ))}
    </div>
  );
}

export function EquipmentReportDialog({ open, onOpenChange, search, kategori, kondisi, status }: EquipmentReportDialogProps) {
  const [scope, setScope] = useState<ReportScope>('filtered');
  const [format, setFormat] = useState<ReportPrintFormat>('a4');
  const [includePhotos, setIncludePhotos] = useState(false);
  const params = useMemo<EquipmentReportParams>(() => ({
    scope,
    ...(scope === UI_CONSTANTS.ALL_FILTER_VALUE ? {} : { search: search || undefined, kategori, kondisi, status }),
    includeValuation: true,
    includePhotos,
  }), [includePhotos, kategori, kondisi, scope, search, status]);
  const reportQuery = useEquipmentReportQuery(params, open);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setScope('filtered');
      setFormat('a4');
      setIncludePhotos(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[min(96vw,1120px)] gap-3 bg-surface-1 p-0 text-ink">
        <DialogHeader className="equipment-report-screen-only border-b border-hairline px-5 py-4 pr-14">
          <DialogTitle className="text-ink">Laporan inventaris alat</DialogTitle>
          <DialogDescription className="text-xs text-ink-subtle">Ringkasan, daftar alat, nilai, dan foto dalam format yang mudah dibaca.</DialogDescription>
        </DialogHeader>
        <div className="equipment-report-screen-only grid items-start gap-3 border-b border-hairline px-5 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <RadioGroup
            name="equipment-report-scope"
            legend="Ruang lingkup"
            value={scope}
            options={[
              { value: 'filtered', label: 'Sesuai filter' },
              { value: UI_CONSTANTS.ALL_FILTER_VALUE, label: 'Semua alat' },
            ]}
            onValueChange={setScope}
          />
          <ReportFormatSelector name="equipment-report-format" value={format} onValueChange={setFormat} legend="Format" />
          <label className="flex min-h-[var(--touch-target-min)] cursor-pointer items-center gap-2 self-end rounded-lg border border-hairline bg-surface-2 px-3 text-xs text-ink transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring/50 md:min-h-8">
            <Checkbox checked={includePhotos} onChange={(event) => setIncludePhotos(event.currentTarget.checked)} aria-label="Sertakan foto dalam laporan" />
            <span>Sertakan foto</span>
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {reportQuery.isLoading && <div className="space-y-3" aria-label="Memuat laporan" aria-busy="true"><div className="motion-safe:animate-pulse h-8 rounded bg-surface-2" /><div className="motion-safe:animate-pulse h-40 rounded bg-surface-2" /><div className="motion-safe:animate-pulse h-64 rounded bg-surface-2" /></div>}
          {reportQuery.isError && !reportQuery.isLoading && <Card className="border-semantic-danger/30 bg-semantic-danger/5"><CardContent className="space-y-3 pt-5 text-sm text-semantic-danger"><p>{getErrorMessage(reportQuery.error)}</p><Button type="button" variant="outline" onClick={() => void reportQuery.refetch()} className="border-semantic-danger/30 text-semantic-danger"><RefreshCcw size={14} /> Coba lagi</Button></CardContent></Card>}
          {reportQuery.data && !reportQuery.isLoading && !reportQuery.isError && <div id="equipment-report-print">{format === 'a4' ? <A4Document report={reportQuery.data} includePhotos={includePhotos} /> : <PresentationDocument report={reportQuery.data} includePhotos={includePhotos} />}</div>}
        </div>
        <DialogFooter className="equipment-report-screen-only border-t border-hairline bg-surface-2 px-5 py-3 md:pb-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}><X size={14} /> Tutup</Button>
          <Button type="button" onClick={() => printEquipmentReport(format)} disabled={!reportQuery.data || reportQuery.isLoading} className="bg-primary text-primary-foreground"><Printer size={14} /> Cetak / Simpan PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
