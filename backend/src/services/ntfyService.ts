import { runtimeConfig } from '../config/env.js';

export interface NtfyAction {
  action: 'view' | 'broadcast' | 'http';
  label: string;
  url: string;
  clear?: boolean;
}

export interface NtfyMessageOptions {
  topic?: string;
  title: string;
  message: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent' | 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  clickUrl?: string;
  actionLabel?: string;
  actionUrl?: string;
}

export interface BorrowingSubmissionNotificationInput {
  studentName: string;
  equipmentSummary: string;
  borrowingId?: string;
  keperluan?: string;
}

export interface BorrowingReturnReportNotificationInput {
  borrowingId?: string;
  studentName?: string;
  equipmentSummary?: string;
}

function resolveNumericPriority(priority?: NtfyMessageOptions['priority']): number {
  if (typeof priority === 'number' && priority >= 1 && priority <= 5) {
    return Math.round(priority);
  }
  switch (priority) {
    case 'min':
      return 1;
    case 'low':
      return 2;
    case 'default':
      return 3;
    case 'high':
      return 4;
    case 'urgent':
      return 5;
    default:
      return 3;
  }
}

export async function sendNtfyMessage(options: NtfyMessageOptions): Promise<boolean> {
  if (!runtimeConfig.ntfyEnabled) return false;

  const topic = (options.topic || runtimeConfig.ntfyTopic || '').trim();
  if (!topic) return false;

  const serverUrl = runtimeConfig.ntfyServerUrl.replace(/\/$/, '');
  const url = `${serverUrl}`;

  const actions: NtfyAction[] = [];
  if (options.actionUrl && options.actionLabel) {
    actions.push({
      action: 'view',
      label: options.actionLabel,
      url: options.actionUrl,
      clear: true,
    });
  }

  const payload: Record<string, unknown> = {
    topic,
    title: options.title,
    message: options.message,
    priority: resolveNumericPriority(options.priority),
  };

  if (options.tags && options.tags.length > 0) {
    payload.tags = options.tags;
  }

  if (options.clickUrl) {
    payload.click = options.clickUrl;
  }

  if (actions.length > 0) {
    payload.actions = actions;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    // Non-blocking: fail-safe logging to avoid disrupting primary transactions
    console.warn('[ntfyService] Gagal mengirim push notification:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function notifyNewBorrowingSubmission(
  input: BorrowingSubmissionNotificationInput,
): Promise<boolean> {
  const directLink = `${runtimeConfig.ntfyFrontendUrl.replace(/\/$/, '')}/notifications`;
  const message = `${input.studentName} mengajukan peminjaman: ${input.equipmentSummary}. Segera cek untuk menyetujui atau menolak peminjaman.`;

  return sendNtfyMessage({
    title: '📋 Pengajuan Peminjaman Alat Baru',
    message,
    priority: 'high',
    tags: ['clipboard', 'camera'],
    clickUrl: directLink,
    actionLabel: 'Buka Notifikasi CMS',
    actionUrl: directLink,
  });
}

export async function notifyReturnReportSubmitted(
  input: BorrowingReturnReportNotificationInput,
): Promise<boolean> {
  const directLink = `${runtimeConfig.ntfyFrontendUrl.replace(/\/$/, '')}/borrowing`;
  const details = input.studentName ? `${input.studentName} melaporkan pengembalian alat` : 'Ada laporan pengembalian alat baru';
  const message = input.equipmentSummary ? `${details}: ${input.equipmentSummary}. Periksa foto dan verifikasi laporan.` : `${details}. Periksa foto dan verifikasi laporan.`;
  return sendNtfyMessage({
    title: '🔍 Laporan Pengembalian Alat',
    message,
    priority: 'high',
    tags: ['package', 'camera'],
    clickUrl: directLink,
    actionLabel: 'Buka Peminjaman',
    actionUrl: directLink,
  });
}
