import type {
  ContestEntryStatus,
  ContestFinalizeResultKind,
  FinalizeContestEntryPayload,
} from '../types/contests.types';

export type NextPipelineStatus = Extract<
  ContestEntryStatus,
  'sudah_terkirim' | 'menunggu_pengumuman' | 'selesai'
>;

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

export function getPipelineValidationError({
  nextStatus,
  changeReason,
  evidenceFile,
  outcomeStatus,
  resultRows,
}: PipelineValidationInput): string | null {
  if (changeReason.trim().length < 5) {
    return 'Alasan perubahan minimal 5 karakter.';
  }

  if ((nextStatus === 'sudah_terkirim' || nextStatus === 'selesai') && !evidenceFile) {
    return 'Unggah screenshot atau foto bukti terlebih dahulu.';
  }

  if (nextStatus === 'selesai' && outcomeStatus === 'awarded') {
    if (resultRows.length === 0 || resultRows.some((resultRow) => resultRow.result_title.trim().length < 2)) {
      return 'Isi minimal satu nama penghargaan.';
    }
    if (resultRows.some((resultRow) => resultRow.result_kind === 'rank' && Number(resultRow.position) < 1)) {
      return 'Posisi wajib diisi untuk hasil Juara.';
    }
  }

  return null;
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
