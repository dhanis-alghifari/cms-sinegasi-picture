import { Edit2, ExternalLink, Film, MoreVertical, Trophy } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDateShort } from '@/shared/utils/formatDate';
import { formatStatusLabel } from '@/shared/utils/formatLabels';
import { getSafeExternalUrl } from '@/shared/utils/safeUrl';

import type { Contest } from '../types/contests.types';

interface ContestMobileListProps {
  contests: Contest[];
  onEdit: (contest: Contest) => void;
  onSubmitFilm: (contest: Contest) => void;
  canManage?: boolean;
}

const levelBadgeColors: Record<string, string> = {
  Lokal: 'bg-surface-3 text-ink-subtle border-hairline',
  Regional: 'bg-primary/15 text-primary border-primary/30',
  Nasional: 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30 font-bold',
  Internasional: 'bg-semantic-success/15 text-semantic-success border-semantic-success/30 font-bold',
};

const statusBadgeColors: Record<string, string> = {
  buka: 'bg-semantic-success/15 text-semantic-success border-semantic-success/30 font-semibold',
  proses_penjurian: 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30 font-semibold',
  selesai: 'bg-surface-3 text-ink-tertiary border-hairline',
};

export function ContestMobileList({ contests, onEdit, onSubmitFilm, canManage = true }: ContestMobileListProps) {
  if (contests.length === 0) return <EmptyState title="Belum ada festival / perlombaan" description="Belum ada data event festival film terdaftar untuk kriteria pencarian ini." />;

  return (
    <div className="space-y-3" aria-label="Daftar lomba versi ponsel">
      {contests.map((contest) => (
        <article key={contest.id} className="rounded-xl border border-hairline bg-surface-1 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2">
                <p className="line-clamp-2 text-sm font-semibold text-ink">{contest.nama_lomba}</p>
                {getSafeExternalUrl(contest.website_url) && <a href={getSafeExternalUrl(contest.website_url)} target="_blank" rel="noreferrer" className="mt-0.5 shrink-0 text-ink-tertiary hover:text-primary" aria-label="Buka website lomba"><ExternalLink size={15} aria-hidden="true" /></a>}
              </div>
              <p className="mt-1 truncate text-xs text-ink-tertiary">Oleh: {contest.penyelenggara}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <AuditHistoryButton tableName="contests" recordId={contest.id} />
              {canManage && <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="text-ink-subtle" aria-label={`Aksi untuk ${contest.nama_lomba}`} />}><MoreVertical size={18} aria-hidden="true" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-hairline bg-surface-3 text-ink">
                  <DropdownMenuItem onClick={() => onSubmitFilm(contest)} className="min-h-11 cursor-pointer text-sm"><Film size={16} className="mr-2 text-primary" aria-hidden="true" />Daftarkan karya film</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(contest)} className="min-h-11 cursor-pointer text-sm"><Edit2 size={16} className="mr-2" aria-hidden="true" />Edit data lomba</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`text-xs ${levelBadgeColors[contest.tingkat] ?? ''}`}>{contest.tingkat}</Badge>
            <Badge variant="outline" className={`text-xs ${statusBadgeColors[contest.status] ?? ''}`}>{formatStatusLabel(contest.status)}</Badge>
            <span className="ml-auto text-xs text-ink-tertiary">Deadline {formatDateShort(contest.deadline)}</span>
          </div>
          <div className="mt-3 rounded-lg bg-surface-2 p-3">
            <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Karya submitted</p>
            {contest.submissions && contest.submissions.length > 0 ? <ul className="mt-2 space-y-1.5">{contest.submissions.map((submission) => <li key={submission.id} className="flex min-w-0 items-center gap-2 text-xs"><Film size={14} className="shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 truncate font-medium text-ink">{submission.judul_film}</span>{submission.award_status !== 'Peserta' && <span className="shrink-0 text-[10px] font-semibold text-semantic-warning"><Trophy size={11} className="mr-0.5 inline" aria-hidden="true" />{submission.award_status}</span>}</li>)}</ul> : <p className="mt-1 text-xs italic text-ink-tertiary">Belum ada karya</p>}
          </div>
        </article>
      ))}
    </div>
  );
}
