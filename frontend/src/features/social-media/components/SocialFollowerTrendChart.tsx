import { formatNumber } from '@/shared/utils/formatNumber';
import type { SocialSnapshot } from '../types/socialMedia.types';
import { SOCIAL_PLATFORM_LABELS } from '../utils/publicationRules';

interface AccountOption {
  id: string;
  account_name: string;
  platform: string;
}

interface TrendSeries {
  account: AccountOption;
  points: SocialSnapshot[];
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

function createSeries(accounts: AccountOption[], snapshots: SocialSnapshot[]): TrendSeries[] {
  const grouped = new Map<string, SocialSnapshot[]>();
  for (const snapshot of snapshots) {
    grouped.set(snapshot.social_account_id, [...(grouped.get(snapshot.social_account_id) ?? []), snapshot]);
  }
  return [...grouped.entries()].flatMap(([accountId, points]) => {
    const firstPoint = points[0];
    const account = accounts.find((item) => item.id === accountId) ?? (firstPoint ? {
      id: accountId,
      account_name: firstPoint.account_name || SOCIAL_PLATFORM_LABELS[firstPoint.platform],
      platform: firstPoint.platform,
    } : undefined);
    if (!account) return [];
    return [{ account, points: [...points].sort((left, right) => left.as_of_date.localeCompare(right.as_of_date)) }];
  });
}

function seriesPath(points: SocialSnapshot[]): { path: string; minimum: number; maximum: number; coordinates: Array<{ x: number; y: number; point: SocialSnapshot }> } {
  const width = 640;
  const height = 180;
  const padding = 36;
  const values = points.map((point) => point.audience_count);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum;
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * (width - padding * 2),
    y: spread === 0 ? height / 2 : height - padding - ((point.audience_count - minimum) / spread) * (height - padding * 2),
    point,
  }));
  return {
    path: coordinates.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' '),
    minimum,
    maximum,
    coordinates,
  };
}

export function SocialFollowerTrendChart({ accounts, snapshots }: { accounts: AccountOption[]; snapshots: SocialSnapshot[] }) {
  const series = createSeries(accounts, snapshots);
  const trendSeries = series.filter((item) => item.points.length >= 2);

  return <section className="space-y-3" aria-labelledby="social-follower-trend-title">
    <div>
      <h3 id="social-follower-trend-title" className="text-sm font-semibold text-ink">Tren jumlah pengikut</h3>
      <p className="mt-1 text-xs text-ink-subtle">Garis hanya menghubungkan catatan nyata pada tanggal yang tersimpan; tidak ada nilai harian yang diperkirakan.</p>
    </div>
    {trendSeries.length === 0 ? <p className="rounded-lg border border-dashed border-hairline bg-surface-1 p-4 text-sm text-ink-subtle">Catat jumlah pengikut pada sedikitnya dua tanggal untuk menampilkan tren.</p> : <div className="grid gap-3 xl:grid-cols-2">
      {trendSeries.map(({ account, points }) => {
        const chart = seriesPath(points);
        const first = points[0]!;
        const last = points.at(-1)!;
        return <figure key={account.id} className="min-w-0 rounded-xl border border-hairline bg-surface-1 p-3 sm:p-4">
          <figcaption className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="text-sm font-semibold text-ink">{account.account_name}</p><p className="text-xs text-ink-subtle">{SOCIAL_PLATFORM_LABELS[account.platform as keyof typeof SOCIAL_PLATFORM_LABELS]}</p></div>
            <p className="text-right text-xs text-ink-subtle"><span>Perubahan tercatat </span><strong className={last.audience_count >= first.audience_count ? 'text-semantic-success' : 'text-semantic-danger'}>{last.audience_count > first.audience_count ? '+' : ''}{formatNumber(last.audience_count - first.audience_count)}</strong></p>
          </figcaption>
          <svg className="mt-3 h-40 w-full overflow-visible" viewBox="0 0 640 180" role="img" aria-label={`Tren pengikut ${account.account_name} dari ${formatDate(first.as_of_date)} sampai ${formatDate(last.as_of_date)}`}>
            <text x="0" y="28" className="fill-ink-tertiary" fontSize="11">{formatNumber(chart.maximum)}</text>
            <text x="0" y="160" className="fill-ink-tertiary" fontSize="11">{formatNumber(chart.minimum)}</text>
            <line x1="36" y1="160" x2="620" y2="160" className="stroke-hairline" strokeWidth="1" />
            <path d={chart.path} fill="none" className="stroke-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {chart.coordinates.map(({ x, y, point }) => <circle key={point.id} cx={x} cy={y} r="4.5" className="fill-primary stroke-surface-1" strokeWidth="2"><title>{formatDate(point.as_of_date)}: {formatNumber(point.audience_count)} pengikut</title></circle>)}
          </svg>
          <div className="flex justify-between text-[11px] text-ink-tertiary"><span>{formatDate(first.as_of_date)} · {formatNumber(first.audience_count)}</span><span>{formatDate(last.as_of_date)} · {formatNumber(last.audience_count)}</span></div>
        </figure>;
      })}
    </div>}
  </section>;
}
