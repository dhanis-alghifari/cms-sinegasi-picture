import { z } from 'zod';
import {
  decodeDataEnvelope,
  decodePaginatedResponse,
  decodeWithSchema,
} from '@/shared/api/responseValidation';
import { actorSummarySchema, optionalTextSchema } from '@/shared/api/responseSchemas';
import type {
  BillingRule,
  CashDispute,
  CashDisputeListResponse,
  CashDisputeQuota,
  CashDisputeSummary,
  CashInApiResponse,
  CashInResult,
  CashPaymentMethod,
  CashReport,
  CashReportBreakdown,
  CashReportControl,
  CashReportDailyPoint,
  CashReportDebtStudent,
  CashReportDetail,
  CashSummary,
  CashTransaction,
  CreateDisputeResponse,
  DebtRecord,
} from '../types/cash.types';

const optionalNumber = z.number().nullable().optional().transform((value) => value ?? undefined);
const transactionTypeSchema = z.enum(['masuk', 'keluar']);
const disputeStatusSchema = z.enum(['pending', 'approved', 'resolved', 'rejected']);
const debtStatusSchema = z.enum(['unpaid', 'paid']);

const cashDisputeSummarySchema: z.ZodType<CashDisputeSummary> = z.object({
  id: z.string().min(1),
  status: disputeStatusSchema,
  reason: optionalTextSchema,
  has_evidence: z.boolean().optional(),
  attempt_number: z.number().int().positive().optional(),
  review_note: optionalTextSchema,
}).loose();

const cashTransactionSchema: z.ZodType<CashTransaction> = z.object({
  id: z.string().min(1),
  student_id: optionalTextSchema,
  student_nama: optionalTextSchema,
  tipe: transactionTypeSchema,
  jumlah: z.number().nonnegative(),
  keterangan: optionalTextSchema,
  foto_bukti_url: optionalTextSchema,
  tanggal: z.string().min(1),
  idempotency_key: z.string().min(1),
  created_by: z.string().min(1),
  created_at: z.string().min(1),
  updated_by: optionalTextSchema,
  updated_at: optionalTextSchema,
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
  is_billing: z.boolean().optional(),
  metode_pembayaran: optionalTextSchema,
  metode_pembayaran_label: optionalTextSchema,
  dispute: cashDisputeSummarySchema.optional(),
}).loose();

const cashDisputeSchema: z.ZodType<CashDispute> = z.object({
  id: z.string().min(1),
  transaction_id: optionalTextSchema,
  debt_record_id: optionalTextSchema,
  student_id: optionalTextSchema,
  student_nama: optionalTextSchema,
  reason: z.string().min(1),
  bukti_sanggahan_url: optionalTextSchema,
  has_evidence: z.boolean(),
  status: disputeStatusSchema,
  quota_period_start: optionalTextSchema,
  attempt_number: z.number().int().positive(),
  previous_dispute_id: optionalTextSchema,
  review_note: optionalTextSchema,
  resolution_transaction_id: optionalTextSchema,
  created_at: z.string().min(1),
  resolved_at: optionalTextSchema,
  transaction_nominal: optionalNumber,
  transaction_tanggal: optionalTextSchema,
  transaction_keterangan: optionalTextSchema,
}).loose();

const debtRecordSchema: z.ZodType<DebtRecord> = z.object({
  id: z.string().min(1),
  student_id: z.string().min(1),
  student_nama: optionalTextSchema,
  amount: z.number().nonnegative(),
  status: debtStatusSchema,
  source_transaction_id: optionalTextSchema,
  settled_transaction_id: optionalTextSchema,
  created_by: optionalTextSchema,
  updated_by: optionalTextSchema,
  created_at: z.string().min(1),
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
  dispute: cashDisputeSummarySchema.optional(),
}).loose();

const cashSummaryResponseSchema: z.ZodType<CashSummary> = z.object({
  success: z.literal(true),
  saldoUtama: z.number(),
  totalPemasukan: z.number(),
  totalPengeluaran: z.number(),
  totalTunggakanSiswa: z.number(),
}).loose().transform(({ saldoUtama, totalPemasukan, totalPengeluaran, totalTunggakanSiswa }) => ({
  saldoUtama,
  totalPemasukan,
  totalPengeluaran,
  totalTunggakanSiswa,
}));

const billingRuleResponseSchema: z.ZodType<BillingRule> = z.object({
  success: z.literal(true).optional(),
  id: z.string().min(1),
  nominal_iuran_wajib: z.number().nonnegative(),
  holiday_start_date: optionalTextSchema,
  holiday_end_date: optionalTextSchema,
  skip_week: z.boolean(),
  updated_at: z.string().min(1),
  updated_by: optionalTextSchema,
  updated_actor: actorSummarySchema.optional(),
}).loose().transform(({ id, nominal_iuran_wajib, holiday_start_date, holiday_end_date, skip_week, updated_at, updated_by, updated_actor }) => ({
  id,
  nominal_iuran_wajib,
  holiday_start_date,
  holiday_end_date,
  skip_week,
  updated_at,
  updated_by,
  updated_actor,
}));

const cashPaymentMethodSchema: z.ZodType<CashPaymentMethod> = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  label: z.string().min(1),
  is_active: z.boolean(),
  sort_order: z.number().int(),
  created_by: optionalTextSchema,
  updated_by: optionalTextSchema,
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  created_actor: actorSummarySchema.optional(),
  updated_actor: actorSummarySchema.optional(),
  dispute: cashDisputeSummarySchema.optional(),
}).loose();

const cashInResultSchema: z.ZodType<CashInResult> = z.object({
  payment_status: z.enum(['paid', 'partial', 'unpaid']),
  already_recorded: z.boolean(),
  cash_transaction: cashTransactionSchema.nullable(),
  debt: debtRecordSchema.nullable(),
  amount_due: z.number().nonnegative(),
  amount_paid: z.number().nonnegative(),
  amount_outstanding: z.number().nonnegative(),
  payment_method: z.string().nullable().optional(),
}).loose();

const cashInResponseSchema: z.ZodType<CashInApiResponse> = z.object({
  success: z.literal(true),
  data: cashTransactionSchema.nullable(),
  result: cashInResultSchema,
}).loose();

const cashPaymentMethodsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(cashPaymentMethodSchema),
}).loose();

const disputeQuotaSchema: z.ZodType<CashDisputeQuota> = z.object({
  period: z.string().min(1),
  period_start: z.string().min(1),
  limit: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  resets_at: z.string().min(1),
}).loose();

const disputeQuotaResponseSchema = z.object({
  success: z.literal(true),
  data: disputeQuotaSchema,
}).loose();

const createDisputeResponseSchema: z.ZodType<CreateDisputeResponse> = z.object({
  success: z.literal(true),
  data: z.object({
    dispute: cashDisputeSchema,
    quota: disputeQuotaSchema,
    idempotentReplay: z.boolean(),
  }).loose(),
}).loose();

const disputeListResponseSchema: z.ZodType<{ success: true } & CashDisputeListResponse> = z.object({
  success: z.literal(true),
  data: z.array(cashDisputeSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().positive(),
  nextCursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional(),
}).loose().transform(({ success, data, total, page, pageSize, totalPages, nextCursor, hasMore }) => ({
  success,
  data,
  total,
  page,
  pageSize,
  totalPages,
  nextCursor,
  hasMore,
}));

const reportBreakdownSchema: z.ZodType<CashReportBreakdown> = z.object({
  key: z.string(),
  label: z.string(),
  total: z.number(),
  count: z.number().int().nonnegative().optional(),
}).loose();

const reportDailyPointSchema: z.ZodType<CashReportDailyPoint> = z.object({
  date: z.string(),
  income: z.number(),
  expense: z.number(),
}).loose();

const reportDebtStudentSchema: z.ZodType<CashReportDebtStudent> = z.object({
  student_id: z.string(),
  student_nama: z.string(),
  nis: optionalTextSchema,
  kelas: optionalTextSchema,
  total_debt: z.number(),
  debt_record_count: z.number().int().nonnegative(),
  oldest_debt_date: optionalTextSchema,
}).loose();

const reportControlSchema: z.ZodType<CashReportControl> = z.object({
  opening_balance: z.number(),
  period_net_cash_flow: z.number(),
  expected_closing_balance: z.number(),
  closing_balance: z.number(),
  difference: z.number(),
  is_balanced: z.boolean(),
}).loose();

const reportDetailSchema: z.ZodType<CashReportDetail> = z.object({
  id: z.string(),
  date: z.string(),
  type: optionalTextSchema,
  label: optionalTextSchema,
  amount: z.number(),
  note: optionalTextSchema,
  student_id: optionalTextSchema,
  student_name: optionalTextSchema,
  nis: optionalTextSchema,
  kelas: optionalTextSchema,
  payment_method_code: optionalTextSchema,
  payment_method_label: optionalTextSchema,
}).loose();

const cashReportResponseSchema: z.ZodType<CashReport> = z.object({
  success: z.literal(true),
  period: z.object({ start_date: z.string(), end_date: z.string(), days: z.number().int().nonnegative() }),
  summary: z.object({
    total_income: z.number(),
    total_expense: z.number(),
    net_cash_flow: z.number(),
    outstanding_debt: z.number(),
    delinquent_students: z.number().int().nonnegative(),
    debt_record_count: z.number().int().nonnegative(),
    transaction_count: z.number().int().nonnegative(),
  }),
  flow_breakdown: z.array(reportBreakdownSchema),
  income_breakdown: z.array(reportBreakdownSchema),
  expense_breakdown: z.array(reportBreakdownSchema),
  payment_method_breakdown: z.array(reportBreakdownSchema).optional(),
  daily: z.array(reportDailyPointSchema),
  debts: z.array(reportDebtStudentSchema),
  // The database intentionally returns null when a payment-method filter is
  // active because the ledger control values are only meaningful for the
  // complete cash ledger. Normalize that response to the optional field used
  // by the UI instead of rejecting an otherwise valid report.
  control: reportControlSchema.nullable().optional(),
  income_details: z.array(reportDetailSchema).optional(),
  expense_details: z.array(reportDetailSchema).optional(),
}).loose().transform(({ period, summary, flow_breakdown, income_breakdown, expense_breakdown, payment_method_breakdown, daily, debts, control, income_details, expense_details }) => ({
  period,
  summary,
  flow_breakdown,
  income_breakdown,
  expense_breakdown,
  payment_method_breakdown,
  daily,
  debts,
  control: control ?? undefined,
  income_details,
  expense_details,
}));

const disputeEvidenceResponseSchema: z.ZodType<{ success: boolean; data: { url: string } }> = z.object({
  success: z.literal(true),
  data: z.object({ url: z.string().url() }).loose(),
}).loose();

const resolveDisputeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    dispute: cashDisputeSchema,
    resolutionTransactionId: optionalTextSchema,
    idempotentReplay: z.boolean(),
  }).loose(),
}).loose();

export const decodeCashSummary = decodeWithSchema(cashSummaryResponseSchema);
export const decodeCashReport = decodeWithSchema(cashReportResponseSchema);
export const decodeCashPaymentMethods = decodeWithSchema(cashPaymentMethodsResponseSchema);
export const decodeCashTransactions = decodePaginatedResponse(cashTransactionSchema);
export const decodeCashDebts = decodePaginatedResponse(debtRecordSchema);
export const decodeBillingRules = decodeWithSchema(billingRuleResponseSchema);
export const decodeCashIn = decodeWithSchema(cashInResponseSchema);
export const decodeCashOut = decodeDataEnvelope(cashTransactionSchema);
export const decodeCreateDispute = decodeWithSchema(createDisputeResponseSchema);
export const decodeDisputeQuota = decodeWithSchema(disputeQuotaResponseSchema);
export const decodeDisputeEvidence = decodeWithSchema(disputeEvidenceResponseSchema);
export const decodeDisputes = decodeWithSchema(disputeListResponseSchema);
export const decodeResolveDispute = decodeWithSchema(resolveDisputeResponseSchema);
