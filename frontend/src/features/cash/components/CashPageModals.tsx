// src/features/cash/components/CashPageModals.tsx
// Lazy-loaded modal boundary for the cash page.

import { lazy, Suspense } from 'react';

import type {
  CashInFormValues,
  CashOutFormValues,
  DisputeFormValues,
  BillingRulesFormValues,
} from '../schemas/cashSchema';
import type {
  BillingRule,
  CashDisputeQuota,
  CashPaymentMethod,
  CashTransaction,
  DebtRecord,
} from '../types/cash.types';

interface CashPageModalsProps {
  isTreasurerOrTeacher: boolean;
  isStudent: boolean;
  cashInOpen: boolean;
  setCashInOpen: (open: boolean) => void;
  handleCashInSubmit: (values: CashInFormValues) => Promise<void>;
  cashInLoading: boolean;
  cashInError?: unknown;
  paymentMethodsError?: unknown;
  paymentMethods: CashPaymentMethod[];
  isPaymentMethodsLoading: boolean;
  cashOutOpen: boolean;
  setCashOutOpen: (open: boolean) => void;
  currentBalance: number;
  handleCashOutSubmit: (values: CashOutFormValues) => Promise<void>;
  cashOutLoading: boolean;
  cashOutError?: unknown;
  rulesOpen: boolean;
  setRulesOpen: (open: boolean) => void;
  billingRules?: BillingRule | null;
  handleBillingRulesSubmit: (values: BillingRulesFormValues) => Promise<void>;
  billingRulesLoading: boolean;
  billingRulesError?: unknown;
  disputeOpen: boolean;
  setDisputeOpen: (open: boolean) => void;
  disputeTx: CashTransaction | null;
  disputeDebt: DebtRecord | null;
  handleDisputeSubmit: (values: DisputeFormValues) => Promise<void>;
  disputeLoading: boolean;
  disputeError?: unknown;
  disputeQuota?: CashDisputeQuota;
}

const LazyFastCashInModal = lazy(() =>
  import('./FastCashInModal').then(({ FastCashInModal }) => ({ default: FastCashInModal })),
);
const LazyTwoStageCashOutModal = lazy(() =>
  import('./TwoStageCashOutModal').then(({ TwoStageCashOutModal }) => ({ default: TwoStageCashOutModal })),
);
const LazyBillingRulesModal = lazy(() =>
  import('./BillingRulesModal').then(({ BillingRulesModal }) => ({ default: BillingRulesModal })),
);
const LazyStudentDisputeModal = lazy(() =>
  import('./StudentDisputeModal').then(({ StudentDisputeModal }) => ({ default: StudentDisputeModal })),
);

export function CashPageModals({
  isTreasurerOrTeacher,
  isStudent,
  cashInOpen,
  setCashInOpen,
  handleCashInSubmit,
  cashInLoading,
  cashInError,
  paymentMethodsError,
  paymentMethods,
  isPaymentMethodsLoading,
  cashOutOpen,
  setCashOutOpen,
  currentBalance,
  handleCashOutSubmit,
  cashOutLoading,
  cashOutError,
  rulesOpen,
  setRulesOpen,
  billingRules,
  handleBillingRulesSubmit,
  billingRulesLoading,
  billingRulesError,
  disputeOpen,
  setDisputeOpen,
  disputeTx,
  disputeDebt,
  handleDisputeSubmit,
  disputeLoading,
  disputeError,
  disputeQuota,
}: CashPageModalsProps) {
  return (
      <Suspense fallback={null}>
        {isTreasurerOrTeacher && cashInOpen && (
          <LazyFastCashInModal
            open={cashInOpen}
            onOpenChange={setCashInOpen}
            onSubmit={handleCashInSubmit}
            isLoading={cashInLoading}
            error={cashInError}
            paymentMethodsError={paymentMethodsError}
            nominalIuranWajib={billingRules?.nominal_iuran_wajib ?? 5000}
            paymentMethods={paymentMethods}
            isPaymentMethodsLoading={isPaymentMethodsLoading}
          />
        )}

        {isTreasurerOrTeacher && cashOutOpen && (
          <LazyTwoStageCashOutModal
            open={cashOutOpen}
            onOpenChange={setCashOutOpen}
            currentBalance={currentBalance}
            onSubmit={handleCashOutSubmit}
            isLoading={cashOutLoading}
            error={cashOutError}
          />
        )}

        {isTreasurerOrTeacher && rulesOpen && (
          <LazyBillingRulesModal
            open={rulesOpen}
            onOpenChange={setRulesOpen}
            billingRules={billingRules}
            onSubmit={handleBillingRulesSubmit}
            isLoading={billingRulesLoading}
            error={billingRulesError}
          />
        )}

        {isStudent && disputeOpen && (
          <LazyStudentDisputeModal
            open={disputeOpen}
            onOpenChange={setDisputeOpen}
            transaction={disputeTx}
            debt={disputeDebt}
            onSubmit={handleDisputeSubmit}
            isLoading={disputeLoading}
            error={disputeError}
            quota={disputeQuota}
          />
        )}
      </Suspense>
  );
}