import { Edit2, ExternalLink, Layers3, MoreVertical, Trophy } from 'lucide-react';

import { AuditHistoryButton } from '@/features/audit/components/AuditTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDateShort } from '@/shared/utils/formatDate';
import { getSafeExternalUrl } from '@/shared/utils/safeUrl';

import type { Contest } from '../types/contests.types';
import {
  CONTEST_SCOPE_BADGE_CLASSES,
  getContestScopeLabel,
  getContestStatusBadgeClass,
  getContestStatusLabel,
} from '../utils/contestLabels';

interface ContestMobileListProps {
  contests: Contest[];
  onEdit: (contest: Contest) => void;
  onManageEntries: (contest: Contest) => void;
  canManage?: boolean;
}

export function ContestMobileList({ contests, onEdit, onManageEntries, canManage = true }: ContestMobileListProps) {
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
              <p className="mt-1 truncate text-xs text-ink-tertiary">{contest.kota || 'Kota belum diisi'} · Tahun {contest.tahun_event || '-'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <AuditHistoryButton tableName="contests" recordId={contest.id} />
              {canManage && <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="text-ink-subtle" aria-label={`Aksi untuk ${contest.nama_lomba}`} />}><MoreVertical size={18} aria-hidden="true" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-hairline bg-surface-3 text-ink">
                  <DropdownMenuItem onClick={() => onManageEntries(contest)} className="min-h-11 cursor-pointer text-sm"><Layers3 size={16} className="mr-2 text-primary" aria-hidden="true" />Kelola karya</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(contest)} className="min-h-11 cursor-pointer text-sm"><Edit2 size={16} className="mr-2" aria-hidden="true" />Edit data lomba</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`text-xs ${CONTEST_SCOPE_BADGE_CLASSES[contest.tingkat] ?? ''}`}>{getContestScopeLabel(contest.tingkat)}</Badge>
            <Badge variant="outline" className={`text-xs ${getContestStatusBadgeClass(contest.status_public ?? contest.status)}`}>{getContestStatusLabel(contest.status_public ?? contest.status)}</Badge>
            <span className="ml-auto text-xs text-ink-tertiary">Deadline {formatDateShort(contest.deadline)}</span>
          </div>
          <div className="mt-3 rounded-lg bg-surface-2 p-3">
            <p className="text-[10px] uppercase tracking-wide text-ink-tertiary">Karya submitted</p>
            {typeof contest.entry_count === 'number' && <p className="mt-1 text-[10px] font-semibold text-primary">{contest.entry_count} karya di pipeline</p>}
            {contest.submissions && contest.submissions.length > 0 ? <ul className="mt-2 space-y-1.5">{contest.submissions.map((submission) => <li key={submission.id} className="flex min-w-0 items-center gap-2 text-xs"><Layers3 size={14} className="shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 truncate font-medium text-ink">{submission.judul_film}</span>{submission.award_status !== 'Peserta' && <span className="shrink-0 text-[10px] font-semibold text-semantic-warning"><Trophy size={11} className="mr-0.5 inline" aria-hidden="true" />{submission.award_status}</span>}</li>)}</ul> : <p className="mt-1 text-xs italic text-ink-tertiary">Belum ada karya</p>}
          </div>
        </article>
      ))}
    </div>
  );
}
