import { Send, Trophy } from 'lucide-react';

import { Badge } from '@/shared/ui/primitives/badge';
import { Button } from '@/shared/ui/primitives/button';
import { cn } from '@/shared/utils/cn';
import { CompactListSkeleton } from '@/shared/ui/LoadingSkeletons';

import type {
  ContestEntry,
  ContestWorkTypeOption,
} from '../types/contests.types';
import {
  CONTEST_ENTRY_STATUS_BADGE_CLASSES,
  getContestEntryStatusLabel,
} from '../utils/contestLabels';

interface ContestEntryListProps {
  entries: ContestEntry[];
  isLoading: boolean;
  workTypeOptions: readonly ContestWorkTypeOption[];
  onOpenPipelineUpdate: (entry: ContestEntry) => void;
}

function findWorkTypeLabel(
  entry: ContestEntry,
  workTypeOptions: readonly ContestWorkTypeOption[],
): string {
  return entry.work?.work_type_label
    ?? workTypeOptions.find((workType) => workType.code === entry.work?.work_type_code)?.label
    ?? 'Jenis karya';
}

export function ContestEntryList({
  entries,
  isLoading,
  workTypeOptions,
  onOpenPipelineUpdate,
}: ContestEntryListProps) {
  if (isLoading) {
    return <CompactListSkeleton rows={3} label="Memuat daftar karya..." />;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center text-xs text-ink-tertiary">
        Belum ada karya untuk event ini.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <article key={entry.id} className="rounded-xl border border-hairline bg-surface-2 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {entry.work?.title ?? 'Karya tanpa judul'}
                </p>
                <Badge
                  variant="outline"
                  className={cn('text-[10px]', CONTEST_ENTRY_STATUS_BADGE_CLASSES[entry.pipeline_status])}
                >
                  {getContestEntryStatusLabel(entry.pipeline_status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-tertiary">
                {findWorkTypeLabel(entry, workTypeOptions)}
              </p>
              {entry.result_label && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-semantic-warning">
                  <Trophy size={13} /> {entry.result_label}
                </p>
              )}
            </div>
            {entry.pipeline_status === 'selesai' ? (
              <span className="text-xs text-ink-tertiary">Pipeline selesai</span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenPipelineUpdate(entry)}
                className="self-start text-xs sm:self-center"
              >
                <Send size={13} /> Perbarui pipeline
              </Button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
