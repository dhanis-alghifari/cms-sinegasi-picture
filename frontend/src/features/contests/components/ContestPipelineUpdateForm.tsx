import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { FileImage, Loader2, Send, Upload } from 'lucide-react';

import { getErrorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/primitives/button';
import { Label } from '@/shared/ui/primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { cn } from '@/shared/utils/cn';
import { isOneOf } from '@/shared/utils/isOneOf';

import { useFinalizeContestEntryMutation } from '../hooks/useFinalizeContestEntryMutation';
import { useTransitionContestEntryMutation } from '../hooks/useTransitionContestEntryMutation';
import {
  CONTEST_FINAL_OUTCOME_STATUS_VALUES,
  type ContestEntry,
  type ContestFinalizeResultKind,
} from '../types/contests.types';
import { getContestEntryStatusLabel } from '../utils/contestLabels';
import { ContestAwardResultFields } from './ContestAwardResultFields';
import {
  type AwardResultDraft,
  createEmptyAwardResultDraft,
  getEvidenceFileError,
  getNextPipelineStatus,
  getPipelineValidationError,
  type FinalOutcomeStatus,
  toFinalizeResultPayload,
} from '../utils/contestPipelineRules';

interface ContestPipelineUpdateFormProps {
  entry: ContestEntry;
  onClose: () => void;
}

export function ContestPipelineUpdateForm({
  entry,
  onClose,
}: ContestPipelineUpdateFormProps) {
  const nextPipelineStatus = getNextPipelineStatus(entry.pipeline_status);
  const transitionContestEntryMutation = useTransitionContestEntryMutation();
  const finalizeContestEntryMutation = useFinalizeContestEntryMutation();
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState<File | null>(null);
  const [evidencePreviewUrl, setEvidencePreviewUrl] = useState<string | null>(null);
  const [pipelineChangeReason, setPipelineChangeReason] = useState('');
  const [finalOutcomeStatus, setFinalOutcomeStatus] = useState<FinalOutcomeStatus>('awarded');
  const [awardResultRows, setAwardResultRows] = useState<AwardResultDraft[]>([
    createEmptyAwardResultDraft(),
  ]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const requestError = transitionContestEntryMutation.error || finalizeContestEntryMutation.error;
  const isPipelineSaving = transitionContestEntryMutation.isPending || finalizeContestEntryMutation.isPending;

  useEffect(() => () => {
    if (evidencePreviewUrl) URL.revokeObjectURL(evidencePreviewUrl);
  }, [evidencePreviewUrl]);

  if (!nextPipelineStatus) return null;

  const clearSelectedEvidence = () => {
    setEvidencePreviewUrl(null);
    setSelectedEvidenceFile(null);
  };

  const handleEvidenceFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const evidenceFile = event.target.files?.[0];
    clearSelectedEvidence();
    setValidationError(null);
    if (!evidenceFile) return;

    const fileError = getEvidenceFileError(evidenceFile);
    if (fileError) {
      setValidationError(fileError);
      return;
    }

    setSelectedEvidenceFile(evidenceFile);
    setEvidencePreviewUrl(URL.createObjectURL(evidenceFile));
  };

  const handleAddAwardResult = () => {
    setAwardResultRows((existingResultRows) => [
      ...existingResultRows,
      createEmptyAwardResultDraft(),
    ]);
  };

  const handleRemoveAwardResult = (resultRowIndex: number) => {
    setAwardResultRows((existingResultRows) => existingResultRows.filter(
      (_, candidateIndex) => candidateIndex !== resultRowIndex,
    ));
  };

  const handleAwardResultTitleChange = (resultRowIndex: number, title: string) => {
    setAwardResultRows((existingResultRows) => existingResultRows.map(
      (resultRow, candidateIndex) => candidateIndex === resultRowIndex
        ? { ...resultRow, result_title: title }
        : resultRow,
    ));
  };

  const handleAwardResultKindChange = (
    resultRowIndex: number,
    resultKind: ContestFinalizeResultKind,
  ) => {
    setAwardResultRows((existingResultRows) => existingResultRows.map(
      (resultRow, candidateIndex) => candidateIndex === resultRowIndex
        ? {
          ...resultRow,
          result_kind: resultKind,
          position: resultKind === 'rank' ? resultRow.position || '1' : '',
        }
        : resultRow,
    ));
  };

  const handleAwardResultPositionChange = (resultRowIndex: number, position: string) => {
    setAwardResultRows((existingResultRows) => existingResultRows.map(
      (resultRow, candidateIndex) => candidateIndex === resultRowIndex
        ? { ...resultRow, position }
        : resultRow,
    ));
  };

  const handlePipelineUpdateSubmit = async () => {
    const validationMessage = getPipelineValidationError({
      nextStatus: nextPipelineStatus,
      changeReason: pipelineChangeReason,
      evidenceFile: selectedEvidenceFile,
      outcomeStatus: finalOutcomeStatus,
      resultRows: awardResultRows,
    });
    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }

    setValidationError(null);
    if (nextPipelineStatus === 'selesai') {
      if (!selectedEvidenceFile) return;
      await finalizeContestEntryMutation.mutateAsync({
        entryId: entry.id,
        evidenceFile: selectedEvidenceFile,
        payload: {
          outcome_status: finalOutcomeStatus,
          results: finalOutcomeStatus === 'awarded'
            ? toFinalizeResultPayload(awardResultRows)
            : [],
          change_reason: pipelineChangeReason.trim(),
        },
      });
    } else {
      await transitionContestEntryMutation.mutateAsync({
        entryId: entry.id,
        evidenceFile: nextPipelineStatus === 'sudah_terkirim'
          ? selectedEvidenceFile ?? undefined
          : undefined,
        payload: {
          status: nextPipelineStatus,
          change_reason: pipelineChangeReason.trim(),
        },
      });
    }
    onClose();
  };

  return (
    <section className="space-y-4 rounded-xl border border-semantic-warning/30 bg-semantic-warning/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Perbarui pipeline</p>
          <p className="mt-0.5 text-xs text-ink-tertiary">{entry.work?.title}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Tutup</Button>
      </div>

      {(requestError || validationError) && (
        <div role="alert" className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 px-3 py-2 text-xs text-semantic-danger">
          {validationError ?? getErrorMessage(requestError)}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-ink-muted">Status berikutnya</Label>
        <Select value={nextPipelineStatus} disabled>
          <SelectTrigger className="h-11 bg-surface-1 text-sm">
            <SelectValue>{getContestEntryStatusLabel(nextPipelineStatus)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={nextPipelineStatus}>
              {getContestEntryStatusLabel(nextPipelineStatus)}
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-ink-tertiary">
          Pipeline diperbarui berurutan agar riwayat tetap akurat.
        </p>
      </div>

      {(nextPipelineStatus === 'sudah_terkirim' || nextPipelineStatus === 'selesai') && (
        <div className="space-y-2">
          <Label htmlFor="contest-evidence" className="text-xs text-ink-muted">
            Screenshot / foto bukti *
          </Label>
          <label
            htmlFor="contest-evidence"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-surface-1 px-4 py-5 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
          >
            {evidencePreviewUrl
              ? <img src={evidencePreviewUrl} alt="Pratinjau bukti" className="max-h-44 rounded-lg object-contain" />
              : <Upload size={22} className="text-primary" />}
            <span className="text-xs font-medium text-ink">
              {selectedEvidenceFile?.name ?? 'Pilih screenshot atau foto bukti'}
            </span>
            <span className="text-[11px] text-ink-tertiary">
              JPG, PNG, atau WebP · maksimal 5 MB
            </span>
          </label>
          <input
            id="contest-evidence"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleEvidenceFileSelected}
          />
          {selectedEvidenceFile && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearSelectedEvidence}>
              <FileImage size={13} /> Ganti / hapus bukti
            </Button>
          )}
        </div>
      )}

      {nextPipelineStatus === 'selesai' && (
        <div className="space-y-4 rounded-xl border border-hairline bg-surface-1 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-ink-muted">Status prestasi *</Label>
            <Select
              value={finalOutcomeStatus}
              onValueChange={(nextOutcomeStatus) => {
                if (isOneOf(nextOutcomeStatus, CONTEST_FINAL_OUTCOME_STATUS_VALUES)) {
                  setFinalOutcomeStatus(nextOutcomeStatus);
                }
              }}
            >
              <SelectTrigger className="h-11 bg-surface-2 text-sm">
                <SelectValue>
                  {finalOutcomeStatus === 'awarded'
                    ? 'Mendapat penghargaan'
                    : 'Tidak mendapat penghargaan'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-surface-3 text-ink">
                <SelectItem value="awarded">Mendapat penghargaan</SelectItem>
                <SelectItem value="not_awarded">Tidak mendapat penghargaan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {finalOutcomeStatus === 'awarded' && (
            <ContestAwardResultFields
              resultRows={awardResultRows}
              onAddResult={handleAddAwardResult}
              onRemoveResult={handleRemoveAwardResult}
              onResultTitleChange={handleAwardResultTitleChange}
              onResultKindChange={handleAwardResultKindChange}
              onResultPositionChange={handleAwardResultPositionChange}
            >
              <ContestAwardResultFields.Header />
              <ContestAwardResultFields.List />
            </ContestAwardResultFields>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="entry-change-reason" className="text-xs text-ink-muted">
          Alasan perubahan *
        </Label>
        <Textarea
          id="entry-change-reason"
          value={pipelineChangeReason}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPipelineChangeReason(event.target.value)}
          rows={2}
          placeholder="Contoh: Bukti pengiriman dari formulir pendaftaran sudah diterima"
          className={cn('bg-surface-1 text-sm', validationError && 'border-semantic-danger')}
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={isPipelineSaving} onClick={() => void handlePipelineUpdateSubmit()}>
          {isPipelineSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Simpan status
        </Button>
      </div>
    </section>
  );
}
