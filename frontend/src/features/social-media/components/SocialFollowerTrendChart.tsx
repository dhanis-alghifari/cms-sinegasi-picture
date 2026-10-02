import { useId } from 'react';
import { formatNumber } from '@/shared/utils/formatNumber';
import type { SocialSnapshot } from '../types/socialMedia.types';
import {
  createSocialFollowerTrendSeries,
  formatSocialFollowerDelta,
  type SocialFollowerTrendAccount,
  type SocialFollowerTrendPoint,
} from '../utils/socialFollowerTrend';
import { SOCIAL_PLATFORM_LABELS } from '../utils/publicationRules';

interface ChartCoordinate {
  x: number;
  y: number;
  point: SocialFollowerTrendPoint;
}

interface ChartModel {
  path: string;
  coordinates: ChartCoordinate[];
  ticks: number[];
  minimum: number;
  maximum: number;
}

const CHART = { width: 680, height: 208, left: 80, right: 16, top: 16, bottom: 36 };

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

function dateValue(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

function valueToY(value: number, minimum: number, maximum: number): number {
  const range = maximum - minimum;
  const normalized = range === 0 ? 0.5 : (value - minimum) / range;
  return CHART.height - CHART.bottom - normalized * (CHART.height - CHART.top - CHART.bottom);
}

function createChartModel(points: SocialFollowerTrendPoint[]): ChartModel {
  const counts = points.map((point) => point.audience_count);
  const observedMinimum = Math.min(...counts);
  const observedMaximum = Math.max(...counts);
  const axisPadding = Math.max(1, Math.ceil((observedMaximum - observedMinimum) * 0.1));
  const minimum = Math.max(0, observedMinimum - axisPadding);
  const maximum = observedMaximum + axisPadding;
  const firstDate = dateValue(points[0]?.as_of_date ?? '');
  const lastDate = dateValue(points.at(-1)?.as_of_date ?? '');
  const timeSpread = lastDate - firstDate;
  const coordinates = points.map((point) => ({
    x: timeSpread === 0
      ? (CHART.width + CHART.left - CHART.right) / 2
      : CHART.left + ((dateValue(point.as_of_date) - firstDate) / timeSpread) * (CHART.width - CHART.left - CHART.right),
    y: valueToY(point.audience_count, minimum, maximum),
    point,
  }));
  const ticks = [...new Set(Array.from({ length: 5 }, (_, index) => Math.round(minimum + ((maximum - minimum) * index) / 4)))];

  return {
    path: coordinates.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' '),
    coordinates,
    ticks,
    minimum,
    maximum,
  };
}

function AccountTrend({ points, account, chartId }: { points: SocialFollowerTrendPoint[]; account: SocialFollowerTrendAccount; chartId: string }) {
  const chart = createChartModel(points);
  const start = points[0];
  const end = points.at(-1);
  if (!start || !end) return null;

  const hasComparison = points.length > 1;
  const titleId = `${chartId}-${account.id}`;
  const descriptionId = `${titleId}-description`;

  return <figure className="social-follower-trend-figure min-w-0 rounded-xl border border-hairline bg-surface-1 p-3 sm:p-4">
    <figcaption className="flex flex-wrap items-start justify-between gap-2">
      <div><p id={titleId} className="text-sm font-semibold text-ink">{account.account_name}</p><p className="text-xs text-ink-subtle">{SOCIAL_PLATFORM_LABELS[account.platform]}</p></div>
      <p className="text-right text-xs text-ink-subtle">
        {hasComparison
          ? <><span>Perubahan sejak {formatDate(start.as_of_date)}: </span><strong className={end.audience_count >= start.audience_count ? 'text-semantic-success' : 'text-semantic-danger'}>{formatSocialFollowerDelta(start.audience_count, end.audience_count)}</strong></>
          : <span>Belum ada catatan sebelumnya untuk dibandingkan.</span>}
      </p>
    </figcaption>
    <svg className="mt-3 h-48 w-full" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
      {chart.ticks.map((tick) => {
        const y = valueToY(tick, chart.minimum, chart.maximum);
        return <g key={tick}>
          <line x1={CHART.left} y1={y} x2={CHART.width - CHART.right} y2={y} className="stroke-hairline" strokeWidth="1" />
          <text x={CHART.left - 8} y={y + 4} textAnchor="end" className="fill-ink-subtle" fontSize="12">{formatNumber(tick)}</text>
        </g>;
      })}
      <path d={chart.path} fill="none" className="stroke-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {chart.coordinates.map(({ x, y, point }) => <circle
        key={point.id}
        cx={x}
        cy={y}
        r={point.is_comparison ? 5 : 4.5}
        className={point.is_comparison ? 'fill-surface-1 stroke-ink-subtle' : 'fill-primary stroke-surface-1'}
        strokeWidth="2"
      ><title>{`${point.is_comparison ? 'Pembanding · ' : ''}${formatDate(point.as_of_date)}: ${formatNumber(point.audience_count)} pengikut`}</title></circle>)}
      <text x={CHART.left} y={CHART.height - 8} textAnchor="start" className="fill-ink-subtle" fontSize="12">{formatDate(start.as_of_date)}</text>
      <text x={CHART.width - CHART.right} y={CHART.height - 8} textAnchor="end" className="fill-ink-subtle" fontSize="12">{formatDate(end.as_of_date)}</text>
    </svg>
    <p id={descriptionId} className="mt-1 text-[11px] text-ink-subtle">
      {hasComparison
        ? `Jumlah pengikut bergerak dari ${formatNumber(start.audience_count)} pada ${formatDate(start.as_of_date)} menjadi ${formatNumber(end.audience_count)} pada ${formatDate(end.as_of_date)}. Jarak titik mengikuti jarak tanggal pencatatan.`
        : `Tercatat ${formatNumber(end.audience_count)} pengikut pada ${formatDate(end.as_of_date)}. Catat kembali pada tanggal lain untuk menghitung perubahan.`}
    </p>
  </figure>;
}

export function SocialFollowerTrendChart({
  accounts,
  snapshots,
  periodLabel,
  showHeading = true,
}: {
  accounts: SocialFollowerTrendAccount[];
  snapshots: SocialSnapshot[];
  periodLabel: string;
  showHeading?: boolean;
}) {
  const chartId = useId();
  const series = createSocialFollowerTrendSeries(accounts, snapshots);

  return <section className="space-y-3" aria-label="Tren jumlah pengikut">
    {showHeading && <div>
      <h3 className="text-sm font-semibold text-ink">Tren jumlah pengikut</h3>
      <p className="mt-1 text-xs text-ink-subtle">Periode: {periodLabel}. Titik dan jarak tanggal berasal dari catatan yang tersimpan.</p>
    </div>}
    {series.length === 0
      ? <p className="rounded-lg border border-dashed border-hairline bg-surface-1 p-4 text-sm text-ink-subtle">Belum ada catatan jumlah pengikut pada periode ini.</p>
      : <div className="grid gap-3 xl:grid-cols-2">{series.map(({ account, points }) => <AccountTrend key={account.id} chartId={chartId} account={account} points={points} />)}</div>}
  </section>;
}
