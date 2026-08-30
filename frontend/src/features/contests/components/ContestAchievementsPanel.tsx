import { useState } from 'react';
import { Search, Trophy } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Pagination } from '@/shared/ui/Pagination';
import { Badge } from '@/shared/ui/primitives/badge';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';

import { useContestAchievementsQuery } from '../hooks/useContestAchievementsQuery';
import type { ContestOutcomeStatus, ContestResultKind } from '../types/contests.types';
import {
  CONTEST_OUTCOME_STATUS_OPTIONS,
  CONTEST_RESULT_KIND_OPTIONS,
  getContestAchievementBadgeLabel,
  getContestOutcomeBadgeClass,
  getContestResultDisplayLabel,
  isContestOutcomeStatus,
  isContestResultKind,
} from '../utils/contestLabels';

export function ContestAchievementsPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [resultKindFilter, setResultKindFilter] = useState<ContestResultKind | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<ContestOutcomeStatus | 'all'>('all');
  const [positionFilter, setPositionFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const achievementsQuery = useContestAchievementsQuery({
    search: debouncedSearchTerm || undefined,
    result_kind: resultKindFilter === 'all' ? undefined : resultKindFilter,
    outcome_status: outcomeFilter === 'all' ? undefined : outcomeFilter,
    position: positionFilter ? Number(positionFilter) : undefined,
    page,
    pageSize: 10,
  });
  const achievementRows = achievementsQuery.data?.data ?? [];

  const handleSearchTermChange = (nextSearchTerm: string) => {
    setSearchTerm(nextSearchTerm);
    setPage(1);
  };

  const handleResultKindFilterChange = (nextResultKind: string | null) => {
    setResultKindFilter(isContestResultKind(nextResultKind) ? nextResultKind : 'all');
    setPage(1);
  };

  const handleOutcomeFilterChange = (nextOutcome: string | null) => {
    setOutcomeFilter(isContestOutcomeStatus(nextOutcome) ? nextOutcome : 'all');
    setPage(1);
  };

  const handlePositionFilterChange = (nextPosition: string) => {
    setPositionFilter(nextPosition.replace(/\D/g, '').slice(0, 5));
    setPage(1);
  };

  const resetAchievementFilters = () => {
    setSearchTerm('');
    setResultKindFilter('all');
    setOutcomeFilter('all');
    setPositionFilter('');
    setPage(1);
  };

  return (
    <section
      className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5"
      aria-labelledby="contest-achievements-title"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="contest-achievements-title" className="flex items-center gap-2 text-base font-semibold text-ink">
            <Trophy size={17} className="text-semantic-warning" aria-hidden="true" />
            Karya &amp; prestasi
          </h2>
          <p className="mt-1 text-xs text-ink-tertiary">
            Cari berdasarkan nama lomba, karya, kategori, Juara 3, 10 besar, atau penghargaan khusus.
          </p>
        </div>
        <p className="text-xs text-ink-tertiary">{achievementsQuery.data?.total ?? 0} catatan</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px_110px_auto]">
        <label className="relative block">
          <span className="sr-only">Cari prestasi</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <Input
            value={searchTerm}
            onChange={(event) => handleSearchTermChange(event.target.value)}
            placeholder="Cari Juara 3, 10 besar, judul karya..."
            className="h-10 pl-9 text-xs"
          />
        </label>

        <Select
          items={[{ value: 'all', label: 'Semua jenis hasil' }, ...CONTEST_RESULT_KIND_OPTIONS]}
          value={resultKindFilter}
          onValueChange={handleResultKindFilterChange}
        >
          <SelectTrigger className="h-10 text-xs">
            <SelectValue placeholder="Jenis hasil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua jenis hasil</SelectItem>
            {CONTEST_RESULT_KIND_OPTIONS.map((resultKindOption) => (
              <SelectItem key={resultKindOption.value} value={resultKindOption.value}>
                {resultKindOption.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={[{ value: 'all', label: 'Semua status' }, ...CONTEST_OUTCOME_STATUS_OPTIONS]}
          value={outcomeFilter}
          onValueChange={handleOutcomeFilterChange}
        >
          <SelectTrigger className="h-10 text-xs">
            <SelectValue placeholder="Status hasil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {CONTEST_OUTCOME_STATUS_OPTIONS.map((outcomeOption) => (
              <SelectItem key={outcomeOption.value} value={outcomeOption.value}>
                {outcomeOption.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          inputMode="numeric"
          value={positionFilter}
          onChange={(event) => handlePositionFilterChange(event.target.value)}
          placeholder="Posisi"
          className="h-10 text-xs"
          aria-label="Filter posisi"
        />
        <Button type="button" variant="outline" size="sm" className="h-10" onClick={resetAchievementFilters}>
          Reset
        </Button>
      </div>

      {achievementsQuery.isLoading ? (
        <div className="rounded-lg border border-dashed border-hairline px-4 py-12 text-center text-xs text-ink-tertiary">
          Memuat rekap prestasi...
        </div>
      ) : achievementsQuery.error ? (
        <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 px-4 py-4 text-xs text-semantic-danger">
          {getErrorMessage(achievementsQuery.error)}
        </div>
      ) : achievementRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-hairline px-4 py-12 text-center text-xs text-ink-tertiary">
          Belum ada hasil yang cocok dengan filter.
        </div>
      ) : (
        <div className="space-y-2">
          {achievementRows.map((achievementRow) => (
            <article
              key={`${achievementRow.entry_id}-${achievementRow.result_id ?? achievementRow.outcome_status}`}
              className="rounded-lg border border-hairline bg-surface-2 p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{achievementRow.work_title}</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {achievementRow.nama_lomba}
                    {achievementRow.kota ? ` · ${achievementRow.kota}` : ''}
                    {achievementRow.tahun_event ? ` · ${achievementRow.tahun_event}` : ''}
                  </p>
                  {achievementRow.category_name && (
                    <p className="mt-1 text-[11px] text-ink-tertiary">Kategori: {achievementRow.category_name}</p>
                  )}
                </div>
                <Badge variant="outline" className={getContestOutcomeBadgeClass(achievementRow.outcome_status)}>
                  {getContestAchievementBadgeLabel(achievementRow.outcome_status)}
                </Badge>
              </div>
              <p className="mt-2 text-xs font-medium text-semantic-warning">
                {getContestResultDisplayLabel(
                  achievementRow.result_kind,
                  achievementRow.result_title,
                  achievementRow.position,
                )}
              </p>
              {achievementRow.notes && (
                <p className="mt-1 text-xs text-ink-tertiary">{achievementRow.notes}</p>
              )}
            </article>
          ))}
          <Pagination
            page={achievementsQuery.data?.page ?? page}
            totalPages={achievementsQuery.data?.totalPages ?? 1}
            total={achievementsQuery.data?.total ?? 0}
            pageSize={achievementsQuery.data?.pageSize ?? 10}
            onPageChange={setPage}
          />
        </div>
      )}
    </section>
  );
}
