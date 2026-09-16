import { contestsService } from './contests.service';
import type {
  ContestEntry,
  FinalizeContestEntryPayload,
  TransitionContestEntryPayload,
} from '../types/contests.types';

type ContestEntryTransitionUpdate = {
  operation: 'transition';
  entryId: string;
  evidenceFile?: File;
  payload: TransitionContestEntryPayload;
};

type ContestEntryFinalizeUpdate = {
  operation: 'finalize';
  entryId: string;
  evidenceFile: File;
  payload: Omit<FinalizeContestEntryPayload, 'evidence_id'>;
};

export type ContestEntryPipelineUpdate =
  | ContestEntryTransitionUpdate
  | ContestEntryFinalizeUpdate;

export interface ContestEntryPipelineUpdateResult {
  entry: ContestEntry;
  refreshAchievements: boolean;
}

async function uploadTransitionEvidence(
  entryId: string,
  evidenceFile: File | undefined,
  existingEvidenceId: string | undefined,
): Promise<string | undefined> {
  if (!evidenceFile) {
    return existingEvidenceId;
  }

  return contestsService.uploadContestEvidence(entryId, 'submitted', evidenceFile);
}

async function transitionContestEntryPipeline(
  update: ContestEntryTransitionUpdate,
): Promise<ContestEntryPipelineUpdateResult> {
  const evidenceId = await uploadTransitionEvidence(
    update.entryId,
    update.evidenceFile,
    update.payload.evidence_id,
  );
  const entry = await contestsService.transitionContestEntry(update.entryId, {
    ...update.payload,
    evidence_id: evidenceId,
  });

  return { entry, refreshAchievements: false };
}

async function finalizeContestEntryPipeline(
  update: ContestEntryFinalizeUpdate,
): Promise<ContestEntryPipelineUpdateResult> {
  const evidenceId = await contestsService.uploadContestEvidence(
    update.entryId,
    'completed',
    update.evidenceFile,
  );
  const response = await contestsService.finalizeContestEntry(update.entryId, {
    ...update.payload,
    evidence_id: evidenceId,
  });

  return { entry: response.entry, refreshAchievements: true };
}

export async function updateContestEntryPipeline(
  update: ContestEntryPipelineUpdate,
): Promise<ContestEntryPipelineUpdateResult> {
  if (update.operation === 'transition') {
    return transitionContestEntryPipeline(update);
  }

  return finalizeContestEntryPipeline(update);
}
