import http from 'node:http';
import https from 'node:https';
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

export type HttpSender = (urlStr: string, bodyObj: unknown, timeoutMs?: number) => Promise<{ ok: boolean; status: number; text: string }>;

export const defaultHttpSender: HttpSender = (urlStr: string, bodyObj: unknown, timeoutMs = 7000) => {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const transport = parsed.protocol === 'https:' ? https : http;
    const jsonStr = JSON.stringify(bodyObj);

    const req = transport.request(parsed, {
      method: 'POST',
      family: 4, // Force IPv4 to bypass Docker/Alpine Linux IPv6 routing timeouts
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr),
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const statusCode = res.statusCode || 0;
        resolve({
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          text: data,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(jsonStr);
    req.end();
  });
};

let customHttpSender: HttpSender | null = null;
export function setCustomHttpSenderForTest(sender: HttpSender | null): void {
  customHttpSender = sender;
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
    const sender = customHttpSender || defaultHttpSender;
    const res = await sender(url, payload, 7000);
    if (!res.ok) {
      console.warn(`[ntfyService] Response not OK (${res.status}): ${res.text}`);
    } else {
      console.log(`[ntfyService] Push notification sent successfully to topic: ${topic}`);
    }
    return res.ok;
  } catch (error) {
    // Non-blocking: fail-safe logging to avoid disrupting primary transactions
    const err = error as Error & { cause?: Error };
    const cause = err?.cause ? ` (Penyebab: ${err.cause.message || err.cause})` : '';
    console.warn('[ntfyService] Gagal mengirim push notification:', err?.message || error, cause);
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
