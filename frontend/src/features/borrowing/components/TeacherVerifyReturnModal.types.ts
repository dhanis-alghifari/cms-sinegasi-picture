import type { BorrowingRecord, ReturnItemCondition, ReturnReportDecision, ReturnReportVerificationMethod } from '../types/borrowing.types';

export type ConditionState = Record<string, { condition: string; repair_cost?: number }>;
export type ItemOutcome = { status: 'returned' | 'pending_resolution'; condition: string };
export type ItemErrors = Record<string, string>;

export interface TeacherVerifyReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: BorrowingRecord | null;
  onSubmit: (values: { borrowing_id: string; report_id: string; decision: ReturnReportDecision; verification_method: ReturnReportVerificationMethod; item_conditions: ReturnItemCondition[]; rejection_reason?: string; change_reason: string }) => Promise<void>;
  isLoading?: boolean;
  error?: unknown;
}
