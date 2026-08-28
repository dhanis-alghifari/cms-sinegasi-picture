import { useState } from 'react';
import { Search, Trophy } from 'lucide-react';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useContestAchievementsQuery } from '../queries/useContestAchievementsQuery';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/common/Pagination';
import { getErrorMessage } from '@/shared/api/errors';
import type { ContestOutcomeStatus, ContestResultKind } from '../types/contests.types';

const RESULT_KIND_OPTIONS: Array<{ value: ContestResultKind; label: string }> = [
  { value: 'rank', label: 'Juara / peringkat' },
  { value: 'top_n', label: 'Top N' },
  { value: 'special_award', label: 'Penghargaan khusus' },
  { value: 'finalist', label: 'Finalis' },
  { value: 'nominee', label: 'Nominasi' },
  { value: 'honorable_mention', label: 'Honorable mention' },
  { value: 'other', label: 'Lainnya' },
];

const OUTCOME_OPTIONS: Array<{ value: ContestOutcomeStatus; label: string }> = [
  { value: 'awarded', label: 'Mendapat penghargaan' },
  { value: 'not_awarded', label: 'Belum mendapat penghargaan' },
  { value: 'pending', label: 'Menunggu hasil' },
];

function resultLabel(kind: ContestResultKind | null, title: string, position?: number | null): string {
  if (kind === 'rank' && position) return title.toLowerCase() === `juara ${position}`.toLowerCase() ? title : `Juara ${position}${title ? ` · ${title}` : ''}`;
  if (kind === 'top_n' && position) return title.toLowerCase() === `${position} besar`.toLowerCase() ? title : `${position} besar${title ? ` · ${title}` : ''}`;
  return title;
}

export function ContestAchievementsPanel() {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [position, setPosition] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const query = useContestAchievementsQuery({
    search: debouncedSearch || undefined,
    result_kind: kind === 'all' ? undefined : kind as ContestResultKind,
    outcome_status: outcome === 'all' ? undefined : outcome as ContestOutcomeStatus,
    position: position ? Number(position) : undefined,
    page,
    pageSize: 10,
  });
  const rows = query.data?.data ?? [];

  const reset = () => { setSearch(''); setKind('all'); setOutcome('all'); setPosition(''); setPage(1); };

  return (
    <section className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5" aria-labelledby="contest-achievements-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="contest-achievements-title" className="flex items-center gap-2 text-base font-semibold text-ink"><Trophy size={17} className="text-semantic-warning" />Karya &amp; prestasi</h2>
          <p className="mt-1 text-xs text-ink-tertiary">Cari berdasarkan nama lomba, karya, kategori, Juara 3, 10 besar, atau penghargaan khusus.</p>
        </div>
        <p className="text-xs text-ink-tertiary">{query.data?.total ?? 0} catatan</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px_110px_auto]">
        <label className="relative block"><span className="sr-only">Cari prestasi</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari Juara 3, 10 besar, judul karya..." className="h-10 pl-9 text-xs" /></label>
        <Select items={[{ value: 'all', label: 'Semua jenis hasil' }, ...RESULT_KIND_OPTIONS]} value={kind} onValueChange={(value) => { setKind(value || 'all'); setPage(1); }}><SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Jenis hasil" /></SelectTrigger><SelectContent><SelectItem value="all">Semua jenis hasil</SelectItem>{RESULT_KIND_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
        <Select items={[{ value: 'all', label: 'Semua status' }, ...OUTCOME_OPTIONS]} value={outcome} onValueChange={(value) => { setOutcome(value || 'all'); setPage(1); }}><SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Status hasil" /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{OUTCOME_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
        <Input inputMode="numeric" value={position} onChange={(event) => { setPosition(event.target.value.replace(/\D/g, '').slice(0, 5)); setPage(1); }} placeholder="Posisi" className="h-10 text-xs" aria-label="Filter posisi" />
        <Button type="button" variant="outline" size="sm" className="h-10" onClick={reset}>Reset</Button>
      </div>

      {query.isLoading ? <div className="rounded-lg border border-dashed border-hairline px-4 py-12 text-center text-xs text-ink-tertiary">Memuat rekap prestasi...</div> : query.error ? <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 px-4 py-4 text-xs text-semantic-danger">{getErrorMessage(query.error)}</div> : rows.length === 0 ? <div className="rounded-lg border border-dashed border-hairline px-4 py-12 text-center text-xs text-ink-tertiary">Belum ada hasil yang cocok dengan filter.</div> : (
        <div className="space-y-2">
          {rows.map((row) => (
            <article key={`${row.entry_id}-${row.result_id ?? row.outcome_status}`} className="rounded-lg border border-hairline bg-surface-2 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{row.work_title}</p><p className="mt-1 text-xs text-ink-subtle">{row.nama_lomba}{row.kota ? ` · ${row.kota}` : ''}{row.tahun_event ? ` · ${row.tahun_event}` : ''}</p>{row.category_name && <p className="mt-1 text-[11px] text-ink-tertiary">Kategori: {row.category_name}</p>}</div>
                <Badge variant="outline" className={row.outcome_status === 'awarded' ? 'border-semantic-success/30 bg-semantic-success/10 text-semantic-success' : row.outcome_status === 'pending' ? 'border-semantic-warning/30 bg-semantic-warning/10 text-semantic-warning' : 'border-hairline text-ink-tertiary'}>{row.outcome_status === 'awarded' ? 'Berprestasi' : row.outcome_status === 'pending' ? 'Menunggu hasil' : 'Tidak mendapat penghargaan'}</Badge>
              </div>
              <p className="mt-2 text-xs font-medium text-semantic-warning">{resultLabel(row.result_kind, row.result_title, row.position)}</p>
              {row.notes && <p className="mt-1 text-xs text-ink-tertiary">{row.notes}</p>}
            </article>
          ))}
          <Pagination page={query.data?.page ?? page} totalPages={query.data?.totalPages ?? 1} total={query.data?.total ?? 0} pageSize={query.data?.pageSize ?? 10} onPageChange={setPage} />
        </div>
      )}
    </section>
  );
}
