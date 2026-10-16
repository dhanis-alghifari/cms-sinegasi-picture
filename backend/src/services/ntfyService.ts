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

export interface CashDisputeNotificationInput {
  disputeId?: string;
  studentName?: string;
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

export type HttpSender = (urlStr: string, bodyObj: unknown, timeoutMs?: number, headers?: Record<string, string>) => Promise<{ ok: boolean; status: number; text: string }>;

export const defaultHttpSender: HttpSender = (urlStr: string, bodyObj: unknown, timeoutMs = 7000, headers = {}) => {
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
        ...headers,
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
  return sendMessage(options, false);
}

function isApprovedPublicGenericConfiguration(): boolean {
  return runtimeConfig.environment === 'production'
    && runtimeConfig.publicDeployment
    && runtimeConfig.ntfyServerUrl === 'https://ntfy.sh'
    && runtimeConfig.ntfyTopic === 'sinegasi-notif'
    && ['', 'sinegasi-notif'].includes(runtimeConfig.ntfyCashReviewTopic)
    && runtimeConfig.ntfyFrontendUrl === 'https://sinegasi.pictures'
    && runtimeConfig.ntfyAccessToken === '';
}

// Only the fixed workflow templates below may opt into anonymous public delivery.
// The exported free-form sender never inherits this permission, even with a token.
async function sendMessage(options: NtfyMessageOptions, fixedWorkflowTemplate: boolean): Promise<boolean> {
  if (!runtimeConfig.ntfyEnabled) return false;
  if (runtimeConfig.ntfyPublicGenericEnabled) {
    if (!fixedWorkflowTemplate || !isApprovedPublicGenericConfiguration()) return false;
  } else if (runtimeConfig.publicDeployment) {
    // Authenticated delivery remains the default. A token does not establish
    // topic read privacy; the public-generic exception is explicitly opt-in.
    try {
      const destination = new URL(runtimeConfig.ntfyServerUrl);
      if (!runtimeConfig.ntfyAccessToken || destination.protocol !== 'https:' || destination.username || destination.password) return false;
    } catch { return false; }
  }

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
    const headers = runtimeConfig.ntfyAccessToken
      ? { Authorization: `Bearer ${runtimeConfig.ntfyAccessToken}` }
      : undefined;
    const res = await sender(url, payload, 7000, headers);
    if (!res.ok) {
      console.warn(`[ntfyService] Response not OK (${res.status})`);
    } else {
      console.log('[ntfyService] Push notification sent successfully');
    }
    return res.ok;
  } catch {
    // Non-blocking: fail-safe logging to avoid disrupting primary transactions
    console.warn('[ntfyService] Gagal mengirim push notification');
    return false;
  }
}

export async function notifyNewBorrowingSubmission(
  _input: BorrowingSubmissionNotificationInput,
): Promise<boolean> {
  const directLink = `${runtimeConfig.ntfyFrontendUrl.replace(/\/$/, '')}/notifications`;
  const message = 'Ada pengajuan peminjaman alat baru. Login ke CMS untuk melihat detail dan memprosesnya.';

  return sendMessage({
    title: '📋 Pengajuan Peminjaman Alat Baru',
    message,
    priority: 'high',
    tags: ['clipboard', 'camera'],
    clickUrl: directLink,
    actionLabel: 'Buka Notifikasi CMS',
    actionUrl: directLink,
  }, true);
}

export async function notifyReturnReportSubmitted(
  _input: BorrowingReturnReportNotificationInput,
): Promise<boolean> {
  const directLink = `${runtimeConfig.ntfyFrontendUrl.replace(/\/$/, '')}/borrowing`;
  const message = 'Ada laporan pengembalian alat baru. Login ke CMS untuk melihat bukti dan memverifikasi laporan.';
  return sendMessage({
    title: '🔍 Laporan Pengembalian Alat',
    message,
    priority: 'high',
    tags: ['package', 'camera'],
    clickUrl: directLink,
    actionLabel: 'Buka Peminjaman',
    actionUrl: directLink,
  }, true);
}

export async function notifyCashDisputeSubmitted(
  _input: CashDisputeNotificationInput,
): Promise<boolean> {
  const directLink = `${runtimeConfig.ntfyFrontendUrl.replace(/\/$/, '')}/cash?scope=manage`;
  return sendMessage({
    topic: runtimeConfig.ntfyCashReviewTopic || runtimeConfig.ntfyTopic,
    title: '⚖️ Sanggahan kas perlu ditinjau',
    message: 'Ada sanggahan kas baru. Login ke CMS untuk melihat bukti dan memberi keputusan sebagai guru.',
    priority: 'high',
    tags: ['warning', 'money_with_wings'],
    clickUrl: directLink,
    actionLabel: 'Buka Kas',
    actionUrl: directLink,
  }, true);
}
