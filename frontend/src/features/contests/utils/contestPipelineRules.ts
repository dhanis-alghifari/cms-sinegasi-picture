import type {
  ContestEntryStatus,
  ContestFinalizeResultKind,
  FinalizeContestEntryPayload,
} from '../types/contests.types';

export type NextPipelineStatus = Extract<
  ContestEntryStatus,
  'sudah_terkirim' | 'menunggu_pengumuman' | 'selesai'
>;

export const CONTEST_PIPELINE_ORDER = [
  'proses_submit',
  'sudah_terkirim',
  'menunggu_pengumuman',
  'selesai',
] as const satisfies readonly ContestEntryStatus[];

export type FinalOutcomeStatus = 'awarded' | 'not_awarded';

export type AwardResultDraft = {
  result_kind: ContestFinalizeResultKind;
  result_title: string;
  position: string;
};

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function getNextPipelineStatus(
  currentStatus: ContestEntryStatus,
): NextPipelineStatus | null {
  const nextStatusByCurrentStatus: Record<ContestEntryStatus, NextPipelineStatus | null> = {
    proses_submit: 'sudah_terkirim',
    sudah_terkirim: 'menunggu_pengumuman',
    menunggu_pengumuman: 'selesai',
    selesai: null,
  };

  return nextStatusByCurrentStatus[currentStatus];
}

export function getPipelineStepIndex(currentStatus: ContestEntryStatus): number {
  const stepIndex = CONTEST_PIPELINE_ORDER.indexOf(currentStatus);
  return stepIndex >= 0 ? stepIndex : 0;
}

export function createEmptyAwardResultDraft(): AwardResultDraft {
  return { result_kind: 'rank', result_title: '', position: '1' };
}

export function isSupportedEvidenceFile(file: File): boolean {
  return ALLOWED_EVIDENCE_TYPES.has(file.type)
    && file.size >= 1
    && file.size <= MAX_EVIDENCE_BYTES;
}

export function getEvidenceFileError(file: File): string | null {
  return isSupportedEvidenceFile(file)
    ? null
    : 'Bukti harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.';
}

type PipelineValidationInput = {
  nextStatus: NextPipelineStatus;
  changeReason: string;
  evidenceFile: File | null;
  outcomeStatus: FinalOutcomeStatus;
  resultRows: AwardResultDraft[];
};

export type PipelineValidationField = 'change_reason' | 'evidence' | 'awards';

export type PipelineValidationIssue = {
  field: PipelineValidationField;
  message: string;
};

export function getPipelineValidationIssues({
  nextStatus,
  changeReason,
  evidenceFile,
  outcomeStatus,
  resultRows,
}: PipelineValidationInput): PipelineValidationIssue[] {
  const issues: PipelineValidationIssue[] = [];

  if (changeReason.trim().length < 5) {
    issues.push({ field: 'change_reason', message: 'Alasan perubahan minimal 5 karakter.' });
  }

  if ((nextStatus === 'sudah_terkirim' || nextStatus === 'selesai') && !evidenceFile) {
    issues.push({ field: 'evidence', message: 'Unggah screenshot atau foto bukti terlebih dahulu.' });
  }

  if (nextStatus === 'selesai' && outcomeStatus === 'awarded') {
    if (resultRows.length === 0 || resultRows.some((resultRow) => resultRow.result_title.trim().length < 2)) {
      issues.push({ field: 'awards', message: 'Isi minimal satu nama penghargaan.' });
    }
    if (issues.every((issue) => issue.field !== 'awards')
      && resultRows.some((resultRow) => resultRow.result_kind === 'rank' && Number(resultRow.position) < 1)) {
      issues.push({ field: 'awards', message: 'Posisi wajib diisi untuk hasil Juara.' });
    }
  }

  return issues;
}

export function getPipelineValidationIssue(input: PipelineValidationInput): PipelineValidationIssue | null {
  return getPipelineValidationIssues(input)[0] ?? null;
}

export function getPipelineValidationError(input: PipelineValidationInput): string | null {
  return getPipelineValidationIssue(input)?.message ?? null;
}

export function toFinalizeResultPayload(
  resultRows: AwardResultDraft[],
): FinalizeContestEntryPayload['results'] {
  return resultRows.map((resultRow) => ({
    result_kind: resultRow.result_kind,
    result_title: resultRow.result_title.trim(),
    position: resultRow.result_kind === 'rank' ? Number(resultRow.position) : null,
  }));
}
