import { useState } from 'react';
import { AlertCircle, CalendarClock, Clock3, FileImage, History, Image as ImageIcon } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { ImagePreviewDialog } from '@/shared/ui/ImagePreviewDialog';
import { Badge } from '@/shared/ui/primitives/badge';
import { Button } from '@/shared/ui/primitives/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/primitives/sheet';
import { formatNumber } from '@/shared/utils/formatNumber';

import { useContestAchievementDetailQuery, useContestEvidenceAccessQuery } from '../hooks/useContestAchievementsQuery';
import type { ContestAchievementAward, ContestAchievementEvidence, ContestOutcomeStatus } from '../types/contests.types';
import {
  getContestAchievementBadgeLabel,
  getContestEntryStatusLabel,
  getContestOutcomeStatusLabel,
  getContestOutcomeBadgeClass,
  getContestResultDisplayLabel,
  getContestResultKindLabel,
  isContestOutcomeStatus,
} from '../utils/contestLabels';

interface ContestAchievementDetailSheetProps {
  entryId: string | null;
  onOpenChange: (open: boolean) => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Tanggal tidak tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatEvidenceType(type: ContestAchievementEvidence['evidence_type']): string {
  if (type === 'submission') return 'Bukti pengiriman';
  if (type === 'result') return 'Bukti hasil';
  return 'Bukti lainnya';
}

function getTimelineLabel(kind: 'status' | 'result', value: string | null | undefined): string {
  if (kind === 'result') {
    if (isContestOutcomeStatus(value)) return getContestOutcomeStatusLabel(value);
    return 'Hasil diperbarui';
  }
  return getContestEntryStatusLabel(value);
}

function AwardList({
  awards,
  outcomeStatus,
}: {
  awards: ContestAchievementAward[];
  outcomeStatus: ContestOutcomeStatus;
}) {
  if (outcomeStatus === 'not_awarded') {
    return <p className="text-xs text-ink-tertiary">Tidak mendapat penghargaan.</p>;
  }

  if (awards.length === 0) {
    return <p className="text-xs text-ink-tertiary">Tidak ada rincian penghargaan.</p>;
  }

  return (
    <ul className="space-y-2" aria-label="Daftar penghargaan">
      {awards.map((award) => (
        <li key={award.id} className="rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
          <p className="text-xs font-semibold text-ink">
            {getContestResultDisplayLabel(award.result_kind, award.result_title, award.position)}
          </p>
          <p className="mt-1 text-[11px] text-ink-tertiary">
            {getContestResultKindLabel(award.result_kind)}
            {award.created_at ? ` · ${formatDate(award.created_at)}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ContestAchievementDetailSheet({ entryId, onOpenChange }: ContestAchievementDetailSheetProps) {
  const isMobile = useIsMobile();
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const detailQuery = useContestAchievementDetailQuery(entryId ?? undefined, Boolean(entryId));
  const evidenceAccessQuery = useContestEvidenceAccessQuery(selectedEvidenceId ?? undefined, Boolean(selectedEvidenceId));
  const detail = detailQuery.data;
  const selectedEvidence = detail?.evidence.find((evidence) => evidence.id === selectedEvidenceId);
  const isPreviewOpen = Boolean(selectedEvidence && evidenceAccessQuery.data?.access_url);
  const completedEvidence = detail?.evidence.filter((evidence) => evidence.upload_status === undefined || evidence.upload_status === 'attached') ?? [];

  const handleOpenChange = (open: boolean) => {
    if (!open) setSelectedEvidenceId(null);
    onOpenChange(open);
  };

  return (
    <>
      <Sheet open={Boolean(entryId)} onOpenChange={handleOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={isMobile
            ? 'max-h-[90dvh] rounded-t-2xl border-hairline bg-surface-1 p-0 text-ink'
            : 'w-full border-hairline bg-surface-1 p-0 text-ink sm:max-w-xl'}
        >
          <SheetHeader className="border-b border-hairline pr-12">
            <SheetTitle className="text-ink">Detail karya &amp; prestasi</SheetTitle>
            <SheetDescription className="text-xs text-ink-subtle">
              Lihat hasil akhir, bukti pengiriman, dan riwayat progres karya ini.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {detailQuery.isLoading && <p className="text-xs text-ink-tertiary">Memuat detail karya…</p>}
            {detailQuery.error && (
              <p role="alert" className="flex items-start gap-2 text-xs text-semantic-danger">
                <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                {getErrorMessage(detailQuery.error)}
              </p>
            )}

            {detail && (
              <>
                <section className="space-y-2" aria-labelledby="achievement-detail-work">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 id="achievement-detail-work" className="break-words text-base font-semibold text-ink">
                        {detail.entry.work.title}
                      </h3>
                      <p className="mt-1 text-xs text-ink-subtle">
                        {detail.entry.contest.nama_lomba}
                        {detail.entry.contest.kota ? ` · ${detail.entry.contest.kota}` : ''}
                        {detail.entry.contest.tahun_event ? ` · ${detail.entry.contest.tahun_event}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={getContestOutcomeBadgeClass(detail.entry.outcome_status as ContestOutcomeStatus)}>
                      {getContestAchievementBadgeLabel(detail.entry.outcome_status as ContestOutcomeStatus)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-tertiary">
                    <CalendarClock size={14} aria-hidden="true" />
                    <span>Selesai {formatDate(detail.entry.completed_at)}</span>
                  </div>
                </section>

                <section className="space-y-2" aria-labelledby="achievement-detail-awards">
                  <div className="flex items-center gap-2">
                    <h3 id="achievement-detail-awards" className="text-xs font-semibold text-ink-muted">Hasil penghargaan</h3>
                    <span className="text-[11px] text-ink-tertiary">{formatNumber(detail.awards.length)} hasil</span>
                  </div>
                  <AwardList awards={detail.awards} outcomeStatus={detail.entry.outcome_status} />
                </section>

                <section className="space-y-2" aria-labelledby="achievement-detail-evidence">
                  <div className="flex items-center gap-2">
                    <FileImage size={14} className="text-primary" aria-hidden="true" />
                    <h3 id="achievement-detail-evidence" className="text-xs font-semibold text-ink-muted">Bukti foto</h3>
                  </div>
                  {completedEvidence.length === 0 && (
                    <p className="text-xs text-ink-tertiary">Belum ada bukti foto yang dapat ditampilkan.</p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {completedEvidence.map((evidence) => (
                        <div key={evidence.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-ink" title={evidence.original_filename ?? undefined}>
                              {evidence.original_filename || formatEvidenceType(evidence.evidence_type)}
                            </p>
                            <p className="mt-1 text-[11px] text-ink-tertiary">{formatEvidenceType(evidence.evidence_type)}</p>
                          </div>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            aria-label={`Lihat ${formatEvidenceType(evidence.evidence_type)}`}
                            onClick={() => setSelectedEvidenceId(evidence.id)}
                          >
                            <ImageIcon size={15} aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                  </div>
                  {evidenceAccessQuery.isLoading && <p className="text-xs text-ink-tertiary">Menyiapkan pratinjau foto…</p>}
                  {evidenceAccessQuery.error && (
                    <p role="alert" className="text-xs text-semantic-danger">{getErrorMessage(evidenceAccessQuery.error)}</p>
                  )}
                </section>

                <section className="space-y-2" aria-labelledby="achievement-detail-history">
                  <div className="flex items-center gap-2">
                    <History size={14} className="text-primary" aria-hidden="true" />
                    <h3 id="achievement-detail-history" className="text-xs font-semibold text-ink-muted">Riwayat progres</h3>
                  </div>
                  {detail.timeline.length === 0 && <p className="text-xs text-ink-tertiary">Belum ada riwayat progres.</p>}
                  <ol className="space-y-3 border-s border-hairline ps-4" aria-label="Riwayat perubahan status">
                    {detail.timeline.map((item) => (
                      <li key={item.id} className="relative space-y-1">
                        <span className="absolute -start-[1.275rem] top-1.5 size-2 rounded-full bg-primary" aria-hidden="true" />
                        <p className="text-xs font-medium text-ink">
                          {getTimelineLabel(item.kind, item.to_status)}
                        </p>
                        <p className="text-[11px] leading-relaxed text-ink-subtle">{item.change_reason}</p>
                        <p className="flex items-center gap-1 text-[10px] text-ink-tertiary">
                          <Clock3 size={11} aria-hidden="true" />
                          {formatDate(item.created_at)}
                          {item.changed_by_name ? ` · ${item.changed_by_name}` : ''}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}
          </div>

          <SheetFooter className="border-t border-hairline">
            <SheetClose render={<Button variant="secondary" className="w-full text-xs" />}>Tutup</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ImagePreviewDialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedEvidenceId(null);
        }}
        src={evidenceAccessQuery.data?.access_url ?? null}
        alt={selectedEvidence?.original_filename ? `Pratinjau ${selectedEvidence.original_filename}` : 'Pratinjau bukti foto'}
        title={selectedEvidence ? formatEvidenceType(selectedEvidence.evidence_type) : 'Pratinjau bukti foto'}
        description={selectedEvidence?.original_filename ?? undefined}
      />
    </>
  );
}
