import { useState } from 'react';
import { Search, Trophy } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { UI_CONSTANTS } from '@/shared/constants/ui';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { Pagination } from '@/shared/ui/Pagination';
import { Badge } from '@/shared/ui/primitives/badge';
import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table';
import { formatNumber } from '@/shared/utils/formatNumber';

import { useContestAchievementsQuery } from '../hooks/useContestAchievementsQuery';
import type { ContestAchievementRecord, ContestOutcomeStatus, ContestResultKind } from '../types/contests.types';
import {
  CONTEST_OUTCOME_STATUS_OPTIONS,
  CONTEST_RESULT_KIND_OPTIONS,
  getContestAchievementBadgeLabel,
  getContestOutcomeBadgeClass,
  getContestResultDisplayLabel,
  isContestOutcomeStatus,
  isContestResultKind,
} from '../utils/contestLabels';
import { ContestAchievementDetailSheet } from './ContestAchievementDetailSheet';

function formatCompletedDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

function getAwardSummary(record: ContestAchievementRecord): string {
  if (record.outcome_status === 'not_awarded' || record.awards.length === 0) return 'Tidak mendapat penghargaan';
  return record.awards
    .slice(0, 2)
    .map((award) => getContestResultDisplayLabel(award.result_kind, award.result_title, award.position))
    .join(' · ');
}

function AchievementOutcomeBadge({ status }: { status: ContestAchievementRecord['outcome_status'] }) {
  return (
    <Badge variant="outline" className={getContestOutcomeBadgeClass(status)}>
      {getContestAchievementBadgeLabel(status)}
    </Badge>
  );
}

interface AchievementRowProps {
  record: ContestAchievementRecord;
  onOpenDetail: (entryId: string) => void;
}

function AchievementMobileCard({ record, onOpenDetail }: AchievementRowProps) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{record.work_title}</h3>
          <p className="mt-1 text-xs text-ink-subtle">
            {record.nama_lomba}
            {record.kota ? ` · ${record.kota}` : ''}
            {record.tahun_event ? ` · ${record.tahun_event}` : ''}
          </p>
        </div>
        <AchievementOutcomeBadge status={record.outcome_status} />
      </div>
      <div className="mt-3 space-y-2 border-t border-hairline pt-3">
        <div>
          <p className="text-[11px] text-ink-tertiary">Hasil</p>
          <p className="mt-0.5 text-xs font-medium text-ink">{getAwardSummary(record)}</p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-ink-tertiary">Selesai</p>
            <p className="mt-0.5 text-xs text-ink-subtle">{formatCompletedDate(record.completed_at)}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenDetail(record.entry_id)}>
            Lihat detail
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ContestAchievementsPanel() {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [resultKindFilter, setResultKindFilter] = useState<ContestResultKind | 'all'>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [outcomeFilter, setOutcomeFilter] = useState<Extract<ContestOutcomeStatus, 'awarded' | 'not_awarded'> | 'all'>(UI_CONSTANTS.ALL_FILTER_VALUE);
  const [positionFilter, setPositionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, UI_CONSTANTS.SEARCH_DEBOUNCE_MS);
  const achievementsQuery = useContestAchievementsQuery({
    search: debouncedSearchTerm || undefined,
    result_kind: resultKindFilter === UI_CONSTANTS.ALL_FILTER_VALUE ? undefined : resultKindFilter,
    outcome_status: outcomeFilter === UI_CONSTANTS.ALL_FILTER_VALUE ? undefined : outcomeFilter,
    position: positionFilter ? Number(positionFilter) : undefined,
    page,
    pageSize: UI_CONSTANTS.DEFAULT_PAGE_SIZE,
  });
  const achievementRows = achievementsQuery.data?.data ?? [];

  const handleSearchTermChange = (nextSearchTerm: string) => {
    setSearchTerm(nextSearchTerm);
    setPage(1);
  };

  const handleResultKindFilterChange = (nextResultKind: string | null) => {
    if (outcomeFilter === 'not_awarded') return;
    setResultKindFilter(isContestResultKind(nextResultKind) ? nextResultKind : UI_CONSTANTS.ALL_FILTER_VALUE);
    setPage(1);
  };

  const handleOutcomeFilterChange = (nextOutcome: string | null) => {
    const normalizedOutcome = isContestOutcomeStatus(nextOutcome) && nextOutcome !== 'pending'
      ? nextOutcome
      : UI_CONSTANTS.ALL_FILTER_VALUE;
    setOutcomeFilter(normalizedOutcome);
    if (normalizedOutcome === 'not_awarded') {
      setResultKindFilter(UI_CONSTANTS.ALL_FILTER_VALUE);
      setPositionFilter('');
    }
    setPage(1);
  };

  const handlePositionFilterChange = (nextPosition: string) => {
    if (outcomeFilter === 'not_awarded') return;
    setPositionFilter(nextPosition.replace(/\D/g, '').slice(0, 5));
    setPage(1);
  };

  const resetAchievementFilters = () => {
    setSearchTerm('');
    setResultKindFilter(UI_CONSTANTS.ALL_FILTER_VALUE);
    setOutcomeFilter(UI_CONSTANTS.ALL_FILTER_VALUE);
    setPositionFilter('');
    setPage(1);
  };

  const outcomeOptions = CONTEST_OUTCOME_STATUS_OPTIONS.filter((option) => option.value !== 'pending');
  const isNotAwardedFilter = outcomeFilter === 'not_awarded';

  return (
    <>
      <section
        className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5"
        aria-labelledby="contest-achievements-title"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="contest-achievements-title" className="flex items-center gap-2 text-base font-semibold text-ink">
              <Trophy size={17} className="text-semantic-warning" aria-hidden="true" />
              Karya &amp; prestasi selesai
            </h2>
            <p className="mt-1 text-xs text-ink-tertiary">
              Rekap setiap karya yang sudah menyelesaikan proses lomba, termasuk yang belum mendapat penghargaan.
            </p>
          </div>
          <p className="text-xs text-ink-tertiary" aria-live="polite">
            {formatNumber(achievementsQuery.data?.total ?? 0)} karya selesai
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px_110px_auto]">
          <div className="min-w-0 space-y-1">
            <label htmlFor="contest-achievements-search" className="text-[11px] font-medium text-ink-subtle">Cari</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
              <Input
                id="contest-achievements-search"
                value={searchTerm}
                onChange={(event) => handleSearchTermChange(event.target.value)}
                placeholder="Judul karya, lomba, Juara 3, 10 besar..."
                density="compact"
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-ink-subtle">Status hasil</span>
            <Select
              items={[{ value: UI_CONSTANTS.ALL_FILTER_VALUE, label: 'Semua status hasil' }, ...outcomeOptions]}
              value={outcomeFilter}
              onValueChange={handleOutcomeFilterChange}
            >
              <SelectTrigger size="sm" aria-label="Filter status hasil" className="bg-surface-1 text-xs text-ink">
                <SelectValue placeholder="Status hasil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua status hasil</SelectItem>
                {outcomeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-ink-subtle">Jenis pencapaian</span>
            <Select
              items={[{ value: UI_CONSTANTS.ALL_FILTER_VALUE, label: 'Semua jenis pencapaian' }, ...CONTEST_RESULT_KIND_OPTIONS]}
              value={resultKindFilter}
              onValueChange={handleResultKindFilterChange}
              disabled={isNotAwardedFilter}
            >
              <SelectTrigger size="sm" aria-label="Filter jenis pencapaian" className="bg-surface-1 text-xs text-ink">
                <SelectValue placeholder="Jenis pencapaian" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UI_CONSTANTS.ALL_FILTER_VALUE}>Semua jenis pencapaian</SelectItem>
                {CONTEST_RESULT_KIND_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="contest-achievements-position" className="text-[11px] font-medium text-ink-subtle">Posisi / peringkat</label>
            <Input
              id="contest-achievements-position"
              inputMode="numeric"
              value={positionFilter}
              onChange={(event) => handlePositionFilterChange(event.target.value)}
              placeholder="Contoh: 1, 3, 10"
              density="compact"
              className="text-xs"
              aria-label="Filter posisi atau peringkat"
              disabled={isNotAwardedFilter}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={resetAchievementFilters} className="self-end">Reset</Button>
        </div>
        {isNotAwardedFilter && (
          <p className="text-[11px] text-ink-tertiary" role="status">
            Karya tanpa penghargaan tidak memiliki jenis pencapaian atau posisi peringkat.
          </p>
        )}

        {achievementsQuery.isLoading && (
          <div className="rounded-lg border border-dashed border-hairline px-4 py-12 text-center text-xs text-ink-tertiary">Memuat rekap prestasi…</div>
        )}
        {achievementsQuery.error && (
          <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 px-4 py-4 text-xs text-semantic-danger">
            {getErrorMessage(achievementsQuery.error)}
          </div>
        )}
        {!achievementsQuery.isLoading && !achievementsQuery.error && achievementRows.length === 0 && (
          <div className="rounded-lg border border-dashed border-hairline px-4 py-12 text-center text-xs text-ink-tertiary">
            Belum ada karya selesai yang cocok dengan filter.
          </div>
        )}
        {!achievementsQuery.isLoading && !achievementsQuery.error && achievementRows.length > 0 && (
          <>
            {isMobile ? (
              <div className="space-y-2" aria-label="Daftar karya dan prestasi selesai">
                {achievementRows.map((record) => <AchievementMobileCard key={record.entry_id} record={record} onOpenDetail={setSelectedEntryId} />)}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-hairline">
                <Table>
                  <TableHeader className="bg-surface-2">
                    <TableRow>
                      <TableHead className="text-xs text-ink-subtle">Karya</TableHead>
                      <TableHead className="text-xs text-ink-subtle">Lomba</TableHead>
                      <TableHead className="text-xs text-ink-subtle">Hasil</TableHead>
                      <TableHead className="text-xs text-ink-subtle">Selesai</TableHead>
                      <TableHead className="text-right text-xs text-ink-subtle">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {achievementRows.map((record) => (
                      <TableRow key={record.entry_id}>
                        <TableCell className="max-w-56">
                          <p className="truncate text-xs font-semibold text-ink" title={record.work_title}>{record.work_title}</p>
                          <p className="mt-1 text-[11px] capitalize text-ink-tertiary">{record.work_type_code.replaceAll('_', ' ')}</p>
                        </TableCell>
                        <TableCell className="max-w-64">
                          <p className="truncate text-xs font-medium text-ink" title={record.nama_lomba}>{record.nama_lomba}</p>
                          <p className="mt-1 text-[11px] text-ink-tertiary">
                            {record.kota || 'Kota tidak tersedia'}{record.tahun_event ? ` · ${record.tahun_event}` : ''}
                          </p>
                        </TableCell>
                        <TableCell className="min-w-44">
                          <div className="flex flex-col items-start gap-1.5">
                            <AchievementOutcomeBadge status={record.outcome_status} />
                            <span className="max-w-56 truncate text-xs font-medium text-ink" title={getAwardSummary(record)}>{getAwardSummary(record)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-ink-subtle">{formatCompletedDate(record.completed_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedEntryId(record.entry_id)}>Lihat detail</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Pagination
              page={achievementsQuery.data?.page ?? page}
              totalPages={achievementsQuery.data?.totalPages ?? 1}
              total={achievementsQuery.data?.total ?? 0}
              pageSize={achievementsQuery.data?.pageSize ?? UI_CONSTANTS.DEFAULT_PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <ContestAchievementDetailSheet entryId={selectedEntryId} onOpenChange={(open) => { if (!open) setSelectedEntryId(null); }} />
    </>
  );
}
