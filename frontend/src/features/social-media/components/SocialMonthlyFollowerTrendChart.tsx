import { useId } from 'react';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { SocialMonthlyAudiencePoint, SocialMonthlyAudienceSeries } from '../types/socialMedia.types';
import { SOCIAL_PLATFORM_LABELS } from '../utils/publicationRules';

interface Coordinate {
  x: number;
  y: number;
  point: SocialMonthlyAudiencePoint;
}

interface ChartModel {
  coordinates: Coordinate[];
  segments: string[];
  ticks: number[];
  minimum: number;
  maximum: number;
}

const CHART = { width: 680, height: 224, left: 84, right: 12, top: 16, bottom: 40 };

function formatDate(value: string | null): string {
  if (!value) return 'tanggal tidak tersedia';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

function formatMonth(value: string): string {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(date);
}

function valueToY(value: number, minimum: number, maximum: number): number {
  const spread = maximum - minimum;
  const normalized = spread === 0 ? 0.5 : (value - minimum) / spread;
  return CHART.height - CHART.bottom - normalized * (CHART.height - CHART.top - CHART.bottom);
}

function createChartModel(points: SocialMonthlyAudiencePoint[]): ChartModel | null {
  const observedValues = points.flatMap((point) => point.audience_count === null ? [] : [point.audience_count]);
  if (observedValues.length === 0) return null;

  const observedMinimum = Math.min(...observedValues);
  const observedMaximum = Math.max(...observedValues);
  const padding = Math.max(1, Math.ceil((observedMaximum - observedMinimum) * 0.1));
  const minimum = Math.max(0, observedMinimum - padding);
  const maximum = observedMaximum + padding;
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const coordinates = points.flatMap((point, index) => point.audience_count === null ? [] : [{
    x: CHART.left + (index / Math.max(1, points.length - 1)) * plotWidth,
    y: valueToY(point.audience_count, minimum, maximum),
    point,
  }]);

  const segments: string[] = [];
  let currentSegment: Coordinate[] = [];
  let coordinateIndex = 0;
  for (const point of points) {
    if (point.audience_count === null) {
      if (currentSegment.length > 0) segments.push(currentSegment.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' '));
      currentSegment = [];
      continue;
    }
    const coordinate = coordinates[coordinateIndex++];
    if (coordinate) currentSegment.push(coordinate);
  }
  if (currentSegment.length > 0) segments.push(currentSegment.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' '));

  const ticks = [...new Set(Array.from({ length: 5 }, (_, index) => Math.round(minimum + ((maximum - minimum) * index) / 4)))];
  return { coordinates, segments, ticks, minimum, maximum };
}

function AccountMonthlyTrend({ series, chartId }: { series: SocialMonthlyAudienceSeries; chartId: string }) {
  const chart = createChartModel(series.points);
  const titleId = `${chartId}-${series.id}`;
  const descriptionId = `${titleId}-description`;
  const recordedMonths = series.points.filter((point) => point.audience_count !== null).length;
  const latestPoint = [...series.points].reverse().find((point) => point.audience_count !== null);

  return <figure className="social-follower-trend-figure min-w-0 rounded-xl border border-hairline bg-surface-1 p-3 sm:p-4">
    <figcaption className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p id={titleId} className="text-sm font-semibold text-ink">{series.account_name}</p>
        <p className="text-xs text-ink-subtle">{SOCIAL_PLATFORM_LABELS[series.platform]}{series.is_active ? '' : ' · akun nonaktif'}</p>
      </div>
      <p className="text-right text-xs text-ink-subtle">Snapshot tersedia pada <strong>{recordedMonths} dari 12 bulan</strong></p>
    </figcaption>
    {!chart ? <p className="mt-3 rounded-lg border border-dashed border-hairline bg-surface-2/60 p-4 text-sm text-ink-subtle">Belum ada snapshot pengikut dalam 12 bulan laporan.</p> : <>
      <svg className="mt-3 h-80 w-full" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
        {chart.ticks.map((tick) => {
          const y = valueToY(tick, chart.minimum, chart.maximum);
          return <g key={tick}>
            <line x1={CHART.left} y1={y} x2={CHART.width - CHART.right} y2={y} className="stroke-hairline" strokeWidth="1" />
            <text x={CHART.left - 8} y={y + 4} textAnchor="end" className="fill-ink-subtle" fontSize="11">{formatNumber(tick)}</text>
          </g>;
        })}
        {chart.segments.map((path, index) => <path key={index} d={path} fill="none" className="stroke-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
        {chart.coordinates.map(({ x, y, point }) => <circle key={point.month} cx={x} cy={y} r="4.5" className="fill-primary stroke-surface-1" strokeWidth="2">
          <title>{`${formatMonth(point.month)} · snapshot ${formatDate(point.as_of_date)}: ${formatNumber(point.audience_count ?? 0)} pengikut${point.growth_count === null ? '' : ` · perubahan ${point.growth_count > 0 ? '+' : ''}${formatNumber(point.growth_count)}`}`}</title>
        </circle>)}
        {series.points.map((point, index) => <text
          key={point.month}
          x={CHART.left + (index / Math.max(1, series.points.length - 1)) * (CHART.width - CHART.left - CHART.right)}
          y={CHART.height - 10}
          textAnchor="middle"
          className="fill-ink-subtle"
          fontSize="10"
        ><title>{formatMonth(point.month)}</title>{formatMonth(point.month)}</text>)}
      </svg>
      <p id={descriptionId} className="mt-1 text-[11px] text-ink-subtle">
        Setiap titik memakai snapshot terakhir pada bulan tersebut. Garis terputus saat ada bulan tanpa catatan; bulan kosong tidak dianggap nol.
        {latestPoint?.as_of_date && ` Data terakhir: ${formatNumber(latestPoint.audience_count ?? 0)} pengikut pada ${formatDate(latestPoint.as_of_date)}.`}
      </p>
    </>}
  </figure>;
}

export function SocialMonthlyFollowerTrendChart({
  series,
  periodLabel,
  showHeading = true,
}: {
  series: SocialMonthlyAudienceSeries[];
  periodLabel: string;
  showHeading?: boolean;
}) {
  const chartId = useId();
  const accountGridColumns = series.length > 1 ? 'xl:grid-cols-2' : 'grid-cols-1';

  return <section className="space-y-3" aria-label="Grafik pertumbuhan pengikut bulanan">
    {showHeading && <div>
      <h3 className="text-sm font-semibold text-ink">Grafik tren pengikut 12 bulan</h3>
      <p className="mt-1 text-xs text-ink-subtle">Periode laporan: {periodLabel}. Tiap akun ditampilkan terpisah agar jumlah lintas platform tidak tercampur.</p>
    </div>}
    {series.length === 0
      ? <p className="rounded-lg border border-dashed border-hairline bg-surface-1 p-4 text-sm text-ink-subtle">Belum ada akun media sosial yang dapat dilaporkan.</p>
      : <div className={`grid grid-cols-1 gap-3 ${accountGridColumns}`}>{series.map((account) => <AccountMonthlyTrend key={account.id} chartId={chartId} series={account} />)}</div>}
  </section>;
}
