import { formatNumber } from '@/shared/utils/formatNumber';
import type { SocialPlatform, SocialSnapshot } from '../types/socialMedia.types';
import { SOCIAL_PLATFORM_LABELS } from './publicationRules';

export interface SocialFollowerTrendAccount {
  id: string;
  account_name: string;
  platform: SocialPlatform;
}

export interface SocialFollowerTrendPoint {
  id: string;
  as_of_date: string;
  audience_count: number;
  is_comparison: boolean;
}

export interface SocialFollowerTrendSeries {
  account: SocialFollowerTrendAccount;
  points: SocialFollowerTrendPoint[];
}

export function createSocialFollowerTrendSeries(
  accounts: SocialFollowerTrendAccount[],
  snapshots: SocialSnapshot[],
): SocialFollowerTrendSeries[] {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const grouped = new Map<string, SocialSnapshot[]>();

  for (const snapshot of snapshots) {
    const accountSnapshots = grouped.get(snapshot.social_account_id) ?? [];
    accountSnapshots.push(snapshot);
    grouped.set(snapshot.social_account_id, accountSnapshots);
  }

  return [...grouped.entries()].flatMap(([accountId, accountSnapshots]) => {
    const orderedSnapshots = [...accountSnapshots].sort((left, right) => left.as_of_date.localeCompare(right.as_of_date));
    const firstSnapshot = orderedSnapshots[0];
    if (!firstSnapshot) return [];

    const account = accountsById.get(accountId) ?? {
      id: accountId,
      account_name: firstSnapshot.account_name || SOCIAL_PLATFORM_LABELS[firstSnapshot.platform],
      platform: firstSnapshot.platform,
    };
    const points: SocialFollowerTrendPoint[] = orderedSnapshots.map((snapshot) => ({
      id: snapshot.id,
      as_of_date: snapshot.as_of_date,
      audience_count: snapshot.audience_count,
      is_comparison: false,
    }));
    const comparison = firstSnapshot.comparison_snapshot;

    if (comparison && comparison.as_of_date < firstSnapshot.as_of_date) {
      points.unshift({
        id: `comparison:${firstSnapshot.id}`,
        as_of_date: comparison.as_of_date,
        audience_count: comparison.audience_count,
        is_comparison: true,
      });
    }

    return [{ account, points }];
  });
}

export function formatSocialSnapshotChange(snapshot: SocialSnapshot): string {
  if (snapshot.growth_count === null) return 'Belum ada catatan sebelumnya';

  const change = `${snapshot.growth_count > 0 ? '+' : ''}${formatNumber(snapshot.growth_count)} pengikut`;
  if (snapshot.growth_percent !== null) return `${change} (${formatNumber(snapshot.growth_percent)}%)`;
  if (snapshot.comparison_snapshot?.audience_count === 0) return `${change}; persentase tidak dapat dihitung dari 0`;
  return change;
}

export function formatSocialFollowerDelta(start: number, end: number): string {
  const changeCount = end - start;
  const change = `${changeCount > 0 ? '+' : ''}${formatNumber(changeCount)} pengikut`;
  if (start === 0) return `${change}; persentase tidak dapat dihitung dari 0`;
  const changePercent = Math.round((changeCount / start) * 10_000) / 100;
  return `${change} (${formatNumber(changePercent)}%)`;
}
