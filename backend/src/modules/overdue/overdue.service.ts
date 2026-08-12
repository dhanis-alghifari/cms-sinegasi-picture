import type {
  OverdueAuditInput,
  OverdueBorrowing,
  OverdueCheckReport,
  OverdueCheckResult,
  OverdueLogStore,
  OverdueLogger,
  OverdueNotificationInput,
  OverdueNotificationLog,
  OverdueRepository,
} from './overdue.types.js';

const DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;

/**
 * Owns overdue business rules while keeping HTTP and persistence details out
 * of the module's callers. The repository interface is the only data seam the
 * service needs, so the worker and route can share exactly the same check.
 */
export class OverdueService {
  constructor(
    private readonly repository: OverdueRepository,
    private readonly logStore: OverdueLogStore,
    private readonly logger: OverdueLogger,
  ) {}

  async runCheck(now = new Date()): Promise<OverdueCheckResult> {
    this.logger.info('[SYSTEM:OVERDUE_CHECK] Starting scheduled overdue borrowing check...');

    const managerResult = await this.repository.listManagerIds();
    if (managerResult.error) {
      this.logger.error(
        { error: managerResult.error },
        '[SYSTEM:OVERDUE_CHECK] Gagal membaca penerima notifikasi.',
      );
    }

    const managerIds = managerResult.data;
    let overdueCount = 0;
    let notifiedCount = 0;

    const scanResult = await this.repository.scanOverdueBorrowings(now, async (rows) => {
      const auditedResult = await this.repository.listAuditedBorrowingIds(rows.map((row) => row.id));
      if (auditedResult.error) {
        this.logger.error(
          { error: auditedResult.error },
          '[SYSTEM:OVERDUE_CHECK] Gagal membaca audit log peminjaman.',
        );
      }
      const auditedBorrowingIds = new Set(auditedResult.data);

      for (const borrowing of rows) {
        const dueAt = new Date(borrowing.dueAt);
        if (!Number.isFinite(dueAt.getTime()) || dueAt >= now) continue;

        overdueCount++;
        const daysOverdue = calculateDaysOverdue(now, dueAt);
        const recipients = uniqueRecipients(borrowing, managerIds);

        const notificationResult = await notifyRecipients(
          this.repository,
          borrowing,
          dueAt,
          daysOverdue,
          recipients,
          (input, error) => this.logger.error(
            { error, borrowingId: input.borrowingId, userId: input.userId },
            '[SYSTEM:OVERDUE_CHECK] Gagal membuat notifikasi.',
          ),
        );
        notifiedCount += notificationResult;

        await recordAuditIfNeeded(
          this.repository,
          borrowing,
          dueAt,
          daysOverdue,
          recipients.length,
          auditedBorrowingIds.has(borrowing.id),
          (error, borrowingId) => this.logger.error(
            { error, borrowingId },
            '[SYSTEM:OVERDUE_CHECK] Gagal menulis audit log.',
          ),
        );
        auditedBorrowingIds.add(borrowing.id);

        const logEntry = createOverdueLog(borrowing, now, daysOverdue);
        this.logStore.add(logEntry);
        this.logger.warn(
          { event: 'OVERDUE_DETECTED', ...logEntry },
          `[OVERDUE] ${logEntry.studentName} — ${logEntry.namaAlat} (${daysOverdue} hari telat)`,
        );
      }
    });

    if (scanResult.error) {
      this.logger.error(
        { error: scanResult.error },
        '[SYSTEM:OVERDUE_CHECK] Gagal membaca peminjaman dari Supabase.',
      );
    }

    const result = {
      checkedCount: scanResult.checkedCount,
      overdueCount,
      notifiedCount,
    };
    this.logger.info(
      `[SYSTEM:OVERDUE_CHECK] Done. Checked: ${result.checkedCount}, Overdue: ${result.overdueCount}, Notified: ${result.notifiedCount}`,
    );
    return result;
  }

  async runManualCheck(): Promise<OverdueCheckReport> {
    const result = await this.runCheck();
    return { result, logs: this.logStore.recent(10) };
  }
}

function calculateDaysOverdue(now: Date, dueAt: Date): number {
  return Math.max(1, Math.ceil((now.getTime() - dueAt.getTime()) / DAY_IN_MILLISECONDS));
}

function uniqueRecipients(borrowing: OverdueBorrowing, managerIds: readonly string[]): string[] {
  return [...new Set([
    borrowing.studentUserId,
    ...managerIds,
  ].filter((id): id is string => Boolean(id)))];
}

async function notifyRecipients(
  repository: OverdueRepository,
  borrowing: OverdueBorrowing,
  dueAt: Date,
  daysOverdue: number,
  recipients: readonly string[],
  onError: (input: OverdueNotificationInput, error: unknown) => void,
): Promise<number> {
  let notifiedCount = 0;
  for (const userId of recipients) {
    const input: OverdueNotificationInput = {
      userId,
      borrowingId: borrowing.id,
      studentId: borrowing.studentId,
      studentName: borrowing.studentName || 'Siswa',
      equipment: borrowing.namaAlat,
      dueAt: borrowing.dueAt,
      daysOverdue,
    };
    const result = await repository.createNotification(input);
    if (result.created) notifiedCount++;
    if (result.error) onError(input, result.error);
  }
  return notifiedCount;
}

async function recordAuditIfNeeded(
  repository: OverdueRepository,
  borrowing: OverdueBorrowing,
  dueAt: Date,
  daysOverdue: number,
  recipientCount: number,
  alreadyAudited: boolean,
  onError: (error: unknown, borrowingId: string) => void,
): Promise<void> {
  if (alreadyAudited) return;

  const input: OverdueAuditInput = {
    borrowingId: borrowing.id,
    dueAt: dueAt.toISOString(),
    daysOverdue,
    recipientCount,
  };
  const result = await repository.recordAudit(input);
  if (result.error) onError(result.error, borrowing.id);
}

function createOverdueLog(
  borrowing: OverdueBorrowing,
  now: Date,
  daysOverdue: number,
): OverdueNotificationLog {
  const studentName = borrowing.studentName || 'Siswa';
  return {
    id: `ovd-${Date.now()}-${borrowing.id}`,
    borrowingId: borrowing.id,
    studentName,
    namaAlat: borrowing.namaAlat,
    dueAt: borrowing.dueAt,
    checkedAt: now.toISOString(),
    reason: `SYSTEM:OVERDUE_CHECK — Alat "${borrowing.namaAlat}" telat dikembalikan oleh ${studentName} (${daysOverdue} hari). Notifikasi dikirim ke peminjam dan pengurus.`,
  };
}
