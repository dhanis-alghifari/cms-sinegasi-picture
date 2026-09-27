import { apiClient } from '@/shared/api/client';
import {
  decodeSocialAccount,
  decodeSocialAccounts,
  decodeSocialEvidenceAccess,
  decodeSocialEvidenceCompletion,
  decodeSocialEvidenceReservation,
  decodeSocialInsightPeriod,
  decodeSocialMetrics,
  decodeSocialPublication,
  decodeSocialPublications,
  decodeSocialReport,
  decodeSocialSnapshot,
} from './socialMedia.responses';
import type {
  CreateAccountInput,
  CreateInsightPeriodInput,
  CreatePublicationInput,
  CreateSnapshotInput,
  SocialAccount,
  SocialInsightPeriod,
  SocialMediaDateFilters,
  SocialMediaPage,
  SocialMetrics,
  SocialPublication,
  SocialPublicationFilters,
  SocialReportData,
  SocialSnapshot,
} from '../types/socialMedia.types';

type EvidenceScope = 'publications' | 'insight-periods';

function queryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if ((typeof value === 'string' && value !== '') || typeof value === 'number') params.set(key, String(value));
  }
  return params.toString();
}

function evidenceBase(scope: EvidenceScope, id: string): string {
  return `/api/social-media/${scope}/${encodeURIComponent(id)}`;
}

async function uploadEvidence(scope: EvidenceScope, parentId: string, file: File, idempotencyKey: string): Promise<void> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Bukti harus berformat JPEG, PNG, atau WebP.');
  }
  if (file.size < 1 || file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file bukti maksimal 5 MB.');
  }

  const base = evidenceBase(scope, parentId);
  const reservation = await apiClient.postParsed(`${base}/evidence-uploads`, {
    file_name: file.name,
    content_type: file.type,
    file_size_bytes: file.size,
  }, decodeSocialEvidenceReservation, {
    changeReason: scope === 'publications' ? 'Mengunggah bukti publikasi media sosial' : 'Mengunggah grafik analitik media sosial',
    idempotencyKey,
  });

  const upload = await fetch(reservation.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!upload.ok) throw new Error('Unggah bukti gagal. Periksa jaringan lalu coba lagi.');

  await apiClient.postParsed(`${base}/evidence-uploads/${encodeURIComponent(reservation.evidence.id)}/complete`, {}, decodeSocialEvidenceCompletion, {
    changeReason: 'Memverifikasi bukti media sosial',
    idempotencyKey: crypto.randomUUID(),
  });
}

export const socialMediaService = {
  accounts(includeInactive = false): Promise<SocialAccount[]> {
    const query = includeInactive ? '?include_inactive=true' : '';
    return apiClient.getParsed(`/api/social-media/accounts${query}`, decodeSocialAccounts);
  },
  createAccount(input: CreateAccountInput, idempotencyKey: string): Promise<SocialAccount> {
    return apiClient.postParsed('/api/social-media/accounts', input, decodeSocialAccount, {
      changeReason: 'Menambahkan akun media sosial resmi', idempotencyKey,
    });
  },
  updateAccount(id: string, input: Partial<Pick<SocialAccount, 'account_name' | 'account_url' | 'is_active'>> & { expected_version: number; change_reason: string }, idempotencyKey: string): Promise<SocialAccount> {
    return apiClient.patchParsed(`/api/social-media/accounts/${encodeURIComponent(id)}`, input, decodeSocialAccount, {
      changeReason: input.change_reason, idempotencyKey,
    });
  },
  publications(filters: SocialPublicationFilters): Promise<SocialMediaPage<SocialPublication>> {
    return apiClient.getParsed(`/api/social-media/publications?${queryString(filters)}`, decodeSocialPublications);
  },
  createPublication(input: CreatePublicationInput, idempotencyKey: string): Promise<SocialPublication> {
    return apiClient.postParsed('/api/social-media/publications', input, decodeSocialPublication, {
      changeReason: 'Mencatat publikasi media sosial', idempotencyKey,
    });
  },
  updatePublication(id: string, input: { status: 'recorded'; expected_version: number; change_reason: string }, idempotencyKey: string): Promise<SocialPublication> {
    return apiClient.patchParsed(`/api/social-media/publications/${encodeURIComponent(id)}`, input, decodeSocialPublication, {
      changeReason: input.change_reason, idempotencyKey,
    });
  },
  uploadPublicationEvidence(id: string, file: File, idempotencyKey: string): Promise<void> {
    return uploadEvidence('publications', id, file, idempotencyKey);
  },
  async publicationEvidenceAccess(id: string): Promise<Array<{ id: string; access_url: string; expires_in_seconds: number }>> {
    return apiClient.getParsed(`${evidenceBase('publications', id)}/evidence-access`, decodeSocialEvidenceAccess);
  },
  createSnapshot(input: CreateSnapshotInput, idempotencyKey: string): Promise<SocialSnapshot> {
    return apiClient.postParsed('/api/social-media/snapshots', input, decodeSocialSnapshot, {
      changeReason: 'Mencatat pertumbuhan pengikut media sosial', idempotencyKey,
    });
  },
  createInsightPeriod(input: CreateInsightPeriodInput, idempotencyKey: string): Promise<SocialInsightPeriod> {
    return apiClient.postParsed('/api/social-media/insight-periods', input, decodeSocialInsightPeriod, {
      changeReason: 'Mencatat insight periode media sosial', idempotencyKey,
    });
  },
  updateInsightPeriod(id: string, input: { status: 'recorded'; expected_version: number; change_reason: string }, idempotencyKey: string): Promise<SocialInsightPeriod> {
    return apiClient.patchParsed(`/api/social-media/insight-periods/${encodeURIComponent(id)}`, input, decodeSocialInsightPeriod, {
      changeReason: input.change_reason, idempotencyKey,
    });
  },
  uploadInsightEvidence(id: string, file: File, idempotencyKey: string): Promise<void> {
    return uploadEvidence('insight-periods', id, file, idempotencyKey);
  },
  async insightEvidenceAccess(id: string): Promise<Array<{ id: string; access_url: string; expires_in_seconds: number }>> {
    return apiClient.getParsed(`${evidenceBase('insight-periods', id)}/evidence-access`, decodeSocialEvidenceAccess);
  },
  metrics(filters: SocialMediaDateFilters): Promise<SocialMetrics> {
    return apiClient.getParsed(`/api/social-media/metrics?${queryString(filters)}`, decodeSocialMetrics);
  },
  reports(filters: SocialMediaDateFilters): Promise<SocialReportData> {
    return apiClient.getParsed(`/api/social-media/reports?${queryString(filters)}`, decodeSocialReport);
  },
};
