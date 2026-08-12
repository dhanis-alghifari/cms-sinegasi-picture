export type OverdueCheckResult = {
  checkedCount: number;
  overdueCount: number;
  notifiedCount: number;
};

export type OverdueBorrowing = {
  id: string;
  studentId: string;
  studentName?: string;
  studentUserId?: string;
  namaAlat: string;
  dueAt: string;
  status: string;
};

export type OverdueNotificationInput = {
  userId: string;
  borrowingId: string;
  studentId: string;
  studentName: string;
  equipment: string;
  dueAt: string;
  daysOverdue: number;
};

export type OverdueAuditInput = {
  borrowingId: string;
  dueAt: string;
  daysOverdue: number;
  recipientCount: number;
};

export type OverdueRepositoryError = {
  code?: string;
  message?: string;
  details?: string;
};

export type OverdueNotificationLog = {
  id: string;
  borrowingId: string;
  studentName: string;
  namaAlat: string;
  dueAt: string;
  checkedAt: string;
  reason: string;
};

export type OverdueLogger = {
  info(message: string): void;
  warn(payload: unknown, message: string): void;
  error(payload: unknown, message: string): void;
};

export type OverdueLogStore = {
  add(entry: OverdueNotificationLog): void;
  recent(limit: number): OverdueNotificationLog[];
};

export interface OverdueRepository {
  isConfigured(): boolean;
  scanOverdueBorrowings(
    now: Date,
    onBatch: (rows: readonly OverdueBorrowing[]) => Promise<void>,
  ): Promise<{ checkedCount: number; error: OverdueRepositoryError | null }>;
  listManagerIds(): Promise<{ data: string[]; error: OverdueRepositoryError | null }>;
  createNotification(input: OverdueNotificationInput): Promise<{ created: boolean; error: OverdueRepositoryError | null }>;
  listAuditedBorrowingIds(
    borrowingIds: readonly string[],
  ): Promise<{ data: string[]; error: OverdueRepositoryError | null }>;
  recordAudit(input: OverdueAuditInput): Promise<{ error: OverdueRepositoryError | null }>;
}

export type OverdueCheckReport = {
  result: OverdueCheckResult;
  logs: OverdueNotificationLog[];
};
