import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants/queryKeys';
import { socialMediaService } from '../api/socialMedia.service';
import type {
  CreateAccountInput,
  CreateInsightPeriodInput,
  CreatePublicationInput,
  CreateSnapshotInput,
  SocialMediaDateFilters,
  SocialPublicationFilters,
} from '../types/socialMedia.types';

export function useSocialAccountsQuery(enabled = true, includeInactive = false) {
  return useQuery({ queryKey: [...QUERY_KEYS.SOCIAL_MEDIA_ACCOUNTS, { includeInactive }], queryFn: () => socialMediaService.accounts(includeInactive), enabled, staleTime: 60_000 });
}

export function useSocialPublicationsQuery(filters: SocialPublicationFilters, enabled = true) {
  return useQuery({ queryKey: [...QUERY_KEYS.SOCIAL_MEDIA_PUBLICATIONS, filters], queryFn: () => socialMediaService.publications(filters), enabled, placeholderData: keepPreviousData, staleTime: 30_000 });
}

export function useSocialMetricsQuery(filters: SocialMediaDateFilters, enabled = true) {
  return useQuery({ queryKey: [...QUERY_KEYS.SOCIAL_MEDIA_METRICS, filters], queryFn: () => socialMediaService.metrics(filters), enabled, placeholderData: keepPreviousData, staleTime: 30_000 });
}

export function useSocialReportQuery(filters: SocialMediaDateFilters, enabled = true) {
  return useQuery({ queryKey: [...QUERY_KEYS.SOCIAL_MEDIA_REPORT, filters], queryFn: () => socialMediaService.reports(filters), enabled, staleTime: 30_000 });
}

function invalidateSocialMedia(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: QUERY_KEYS.SOCIAL_MEDIA });
}

export function useCreateSocialAccountMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ input, idempotencyKey }: { input: CreateAccountInput; idempotencyKey: string }) => socialMediaService.createAccount(input, idempotencyKey), onSuccess: () => invalidateSocialMedia(client) });
}

export function useUpdateSocialAccountMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input, idempotencyKey }: { id: string; input: Parameters<typeof socialMediaService.updateAccount>[1]; idempotencyKey: string }) => socialMediaService.updateAccount(id, input, idempotencyKey), onSuccess: () => invalidateSocialMedia(client) });
}

export function useCreateSocialPublicationMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ input, idempotencyKey }: { input: CreatePublicationInput; idempotencyKey: string }) => socialMediaService.createPublication(input, idempotencyKey), onSuccess: () => invalidateSocialMedia(client) });
}

export function useFinalizeSocialPublicationMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, version, idempotencyKey }: { id: string; version: number; idempotencyKey: string }) => socialMediaService.updatePublication(id, { status: 'recorded', expected_version: version, change_reason: 'Menyelesaikan pencatatan publikasi' }, idempotencyKey), onSuccess: () => invalidateSocialMedia(client) });
}

export function useUploadPublicationEvidenceMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, file, idempotencyKey }: { id: string; file: File; idempotencyKey: string }) => socialMediaService.uploadPublicationEvidence(id, file, idempotencyKey), onSuccess: () => invalidateSocialMedia(client) });
}

export function useCreateSocialSnapshotMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ input, idempotencyKey }: { input: CreateSnapshotInput; idempotencyKey: string }) => socialMediaService.createSnapshot(input, idempotencyKey), onSuccess: () => invalidateSocialMedia(client) });
}

export function useCreateSocialInsightMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ input, idempotencyKey }: { input: CreateInsightPeriodInput; idempotencyKey: string }) => socialMediaService.createInsightPeriod(input, idempotencyKey), onSuccess: () => invalidateSocialMedia(client) });
}

export function useUploadInsightEvidenceMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, file, idempotencyKey }: { id: string; file: File; idempotencyKey: string }) => socialMediaService.uploadInsightEvidence(id, file, idempotencyKey), onSuccess: () => invalidateSocialMedia(client) });
}

export function useFinalizeSocialInsightMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, version, idempotencyKey }: { id: string; version: number; idempotencyKey: string }) => socialMediaService.updateInsightPeriod(id, { status: 'recorded', expected_version: version, change_reason: 'Menyelesaikan laporan insight media sosial' }, idempotencyKey), onSuccess: () => invalidateSocialMedia(client) });
}
