import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { formatNumber } from '@/shared/utils/formatNumber';
import { UI_CONSTANTS } from '@/shared/constants/ui';

import { useContestEntriesQuery } from '../hooks/useContestEntriesQuery';
import { useContestWorkTypesQuery } from '../hooks/useContestWorkTypesQuery';
import type { Contest, ContestEntry } from '../types/contests.types';
import { ContestEntryList } from './ContestEntryList';
import { CreateContestEntryForm } from './CreateContestEntryForm';
import { ContestPipelineUpdateForm } from './ContestPipelineUpdateForm';

interface ContestEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest?: Contest | null;
}

export function ContestEntriesDialog({
  open,
  onOpenChange,
  contest,
}: ContestEntriesDialogProps) {
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false);
  const [entryBeingUpdated, setEntryBeingUpdated] = useState<ContestEntry | null>(null);

  const contestEntriesQuery = useContestEntriesQuery(
    contest?.id,
    { page: 1, pageSize: UI_CONSTANTS.CONTEST_ENTRIES_PAGE_SIZE },
    open,
  );
  const workTypeOptionsQuery = useContestWorkTypesQuery(open);
  const contestEntries = contestEntriesQuery.data?.data ?? [];
  const workTypeOptions = workTypeOptionsQuery.data ?? [];
  const contestDialogError = contestEntriesQuery.error || workTypeOptionsQuery.error;

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsCreateFormVisible(false);
      setEntryBeingUpdated(null);
    }
    onOpenChange(nextOpen);
  };

  const handleOpenPipelineUpdate = (entry: ContestEntry) => {
    setIsCreateFormVisible(false);
    setEntryBeingUpdated(entry);
  };

  const handleClosePipelineUpdate = () => {
    setEntryBeingUpdated(null);
  };

  const handleToggleCreateForm = () => {
    setIsCreateFormVisible((isVisible) => !isVisible);
    setEntryBeingUpdated(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden bg-surface-1 p-0 text-ink">
        <DialogHeader className="border-b border-hairline px-6 py-5">
          <div className="flex items-center gap-2 pr-6">
            <FileText size={18} className="text-primary" aria-hidden="true" />
            <DialogTitle className="text-base font-semibold">
              Karya untuk {contest?.nama_lomba ?? 'event'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-ink-subtle">
            Tambahkan karya, unggah bukti pengiriman, lalu pantau hasilnya sampai selesai.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {contestDialogError && (
            <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">
              {getErrorMessage(contestDialogError)}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-2 p-4">
            <div>
              <p className="text-sm font-semibold text-ink">Daftar karya</p>
              <p className="mt-0.5 text-xs text-ink-tertiary">
                {contestEntriesQuery.isLoading
                  ? 'Memuat...'
                  : `${formatNumber(contestEntriesQuery.data?.total ?? 0)} karya terdaftar`}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleToggleCreateForm}
              className="gap-1.5"
            >
              <Plus size={14} />
              {isCreateFormVisible ? 'Tutup form' : 'Tambah karya'}
            </Button>
          </div>

          {isCreateFormVisible && contest && (
            <CreateContestEntryForm
              contestId={contest.id}
              workTypeOptions={workTypeOptions}
              onClose={() => setIsCreateFormVisible(false)}
            />
          )}

          <ContestEntryList
            entries={contestEntries}
            isLoading={contestEntriesQuery.isLoading}
            workTypeOptions={workTypeOptions}
            onOpenPipelineUpdate={handleOpenPipelineUpdate}
          />

          {entryBeingUpdated && (
            <ContestPipelineUpdateForm
              entry={entryBeingUpdated}
              onClose={handleClosePipelineUpdate}
            />
          )}
        </div>

        <DialogFooter className="border-t border-hairline bg-surface-1 px-6 py-4">
          <Button type="button" variant="outline" size="sm" onClick={() => handleDialogOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
