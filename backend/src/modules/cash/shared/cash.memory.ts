import type { CashPaymentMethod } from './cash.types.js';
import type { CashMutationTransaction, CashDebtRecord } from '../ledger/cash.mutations.types.js';
import type { BillingRulesState } from '../reports/cash.reporting.types.js';

export type CashMemoryState = {
  transactions: CashMutationTransaction[];
  debts: CashDebtRecord[];
  paymentMethods: CashPaymentMethod[];
  billingRules: BillingRulesState;
};

/**
 * Shared local-development state for cash read, mutation, reporting, dispute,
 * and payment-method adapters. Production paths use Supabase instead.
 */
export function createCashMemoryState(): CashMemoryState {
  const now = new Date().toISOString();
  return {
    transactions: [],
    debts: [],
    billingRules: {
      nominal_iuran_wajib: 5000,
      holiday_start_date: null,
      holiday_end_date: null,
      skip_week: false,
    },
    paymentMethods: [
      {
        id: 'memory-cash-payment-method-cash',
        code: 'cash',
        label: 'Cash',
        is_active: true,
        sort_order: 10,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'memory-cash-payment-method-qris-dana',
        code: 'qris_dana',
        label: 'QRIS DANA',
        is_active: true,
        sort_order: 20,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'memory-cash-payment-method-qris-gopay',
        code: 'qris_gopay',
        label: 'QRIS GoPay',
        is_active: true,
        sort_order: 30,
        created_at: now,
        updated_at: now,
      },
    ],
  };
}
