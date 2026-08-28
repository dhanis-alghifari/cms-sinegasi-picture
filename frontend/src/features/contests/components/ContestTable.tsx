// src/features/contests/components/ContestTable.tsx
// Table for film contests & festivals displaying name, city, level badge, deadline, entries, and action menu

import { MoreVertical, Edit2, Layers3, ExternalLink, Trophy } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDateShort } from '@/shared/utils/formatDate';
import { getSafeExternalUrl } from '@/shared/utils/safeUrl';
import type { Contest } from '../types/contests.types';
import {
  CONTEST_SCOPE_BADGE_CLASSES,
  getContestScopeLabel,
  getContestStatusBadgeClass,
  getContestStatusLabel,
} from '../utils/contestLabels';
import { AuditHistoryButton } from '@/features/audit/components/AuditTable';

interface ContestTableProps {
  contests: Contest[];
  onEdit: (contest: Contest) => void;
  onManageEntries: (contest: Contest) => void;
  canManage?: boolean;
}

export function ContestTable({
  contests,
  onEdit,
  onManageEntries,
  canManage = true,
}: ContestTableProps) {
  if (contests.length === 0) {
    return (
      <EmptyState
        title="Belum ada festival / perlombaan"
        description="Belum ada data event festival film terdaftar untuk kriteria pencarian ini."
      />
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="border-hairline">
            <TableHead className="text-ink-subtle text-xs font-semibold">Nama Lomba &amp; Kota</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Tingkat</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Deadline</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Status Event</TableHead>
            <TableHead className="text-ink-subtle text-xs font-semibold">Karya Submitted</TableHead>
            <TableHead className="text-right text-ink-subtle text-xs font-semibold">Riwayat</TableHead>
            {canManage && <TableHead className="text-right text-ink-subtle text-xs font-semibold">Aksi</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {contests.map((c) => (
            <TableRow key={c.id} className="border-hairline hover:bg-surface-2/40">
              {/* Contest Name */}
              <TableCell className="text-ink text-xs font-medium">
                <div>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>{c.nama_lomba}</span>
                    {getSafeExternalUrl(c.website_url) && (
                      <a
                        href={getSafeExternalUrl(c.website_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ink-tertiary hover:text-primary transition-colors"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <p className="text-ink-tertiary text-[10px]">{c.kota || 'Kota belum diisi'} · Tahun {c.tahun_event || '-'}</p>
                </div>
              </TableCell>

              {/* Tingkat */}
              <TableCell>
                <Badge variant="outline" className={`text-xs px-2.5 py-0.5 rounded ${CONTEST_SCOPE_BADGE_CLASSES[c.tingkat] ?? ''}`}>
                  {getContestScopeLabel(c.tingkat)}
                </Badge>
              </TableCell>

              {/* Deadline */}
              <TableCell className="text-ink-subtle text-xs font-medium">
                {formatDateShort(c.deadline)}
              </TableCell>

              {/* Status Event */}
              <TableCell>
                <Badge variant="outline" className={`text-xs px-2.5 py-0.5 rounded ${getContestStatusBadgeClass(c.status_public ?? c.status)}`}>
                  {getContestStatusLabel(c.status_public ?? c.status)}
                </Badge>
              </TableCell>

              {/* Submitted Films List */}
              <TableCell className="text-ink-subtle text-xs">
                {typeof c.entry_count === 'number' && <p className="mb-1 text-[10px] font-semibold text-primary">{c.entry_count} karya di pipeline</p>}
                {c.submissions && c.submissions.length > 0 ? (
                  <div className="space-y-1">
                    {c.submissions.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-1.5 text-[11px]">
                        <Layers3 size={12} className="text-primary shrink-0" />
                        <span className="font-semibold text-ink">{sub.judul_film}</span>
                        <span className="text-ink-tertiary">({sub.sutradara_nama})</span>
                        {sub.award_status !== 'Peserta' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-semantic-warning bg-semantic-warning/15 px-1.5 py-0.2 rounded">
                            <Trophy size={10} />
                            {sub.award_status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-ink-tertiary text-xs italic">Belum ada karya</span>
                )}
              </TableCell>

              <TableCell className="text-right"><AuditHistoryButton tableName="contests" recordId={c.id} /></TableCell>

              {/* Action Menu */}
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                    <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-ink-subtle hover:text-ink">
                          <MoreVertical size={14} />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="bg-surface-3 border-hairline text-ink">
                      <DropdownMenuItem onClick={() => onManageEntries(c)} className="text-xs cursor-pointer">
                        <Layers3 size={14} className="mr-2 text-primary" />
                        Kelola Karya
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(c)} className="text-xs cursor-pointer">
                        <Edit2 size={14} className="mr-2 text-ink-subtle" />
                        Edit Data Lomba
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
