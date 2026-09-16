
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

type ModalState = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

interface CashPageModalsProps {
  access: {
    isTreasurerOrTeacher: boolean;
    isStudent: boolean;
  };
  cashIn: ModalState & {
    onSubmit: (values: CashInFormValues) => Promise<void>;
    isLoading: boolean;
    error?: unknown;
    paymentMethodsError?: unknown;
    paymentMethods: CashPaymentMethod[];
    isPaymentMethodsLoading: boolean;
    nominalIuranWajib: number;
  };
  cashOut: ModalState & {
    currentBalance: number;
    onSubmit: (values: CashOutFormValues) => Promise<void>;
    isLoading: boolean;
    error?: unknown;
  };
  billingRules: ModalState & {
    billingRules?: BillingRule | null;
    onSubmit: (values: BillingRulesFormValues) => Promise<void>;
    isLoading: boolean;
    error?: unknown;
  };
  dispute: ModalState & {
    transaction: CashTransaction | null;
    debt: DebtRecord | null;
    onSubmit: (values: DisputeFormValues) => Promise<void>;
    isLoading: boolean;
    error?: unknown;
    quota?: CashDisputeQuota;
  };
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
  access,
  cashIn,
  cashOut,
  billingRules,
  dispute,
}: CashPageModalsProps) {
  const { isTreasurerOrTeacher, isStudent } = access;
  const {
    open: cashInOpen,
    onOpenChange: setCashInOpen,
    onSubmit: handleCashInSubmit,
    isLoading: cashInLoading,
    error: cashInError,
    paymentMethodsError,
    paymentMethods,
    isPaymentMethodsLoading,
    nominalIuranWajib,
  } = cashIn;
  const {
    open: cashOutOpen,
    onOpenChange: setCashOutOpen,
    currentBalance,
    onSubmit: handleCashOutSubmit,
    isLoading: cashOutLoading,
    error: cashOutError,
  } = cashOut;
  const {
    open: rulesOpen,
    onOpenChange: setRulesOpen,
    billingRules: rules,
    onSubmit: handleBillingRulesSubmit,
    isLoading: billingRulesLoading,
    error: billingRulesError,
  } = billingRules;
  const {
    open: disputeOpen,
    onOpenChange: setDisputeOpen,
    transaction: disputeTx,
    debt: disputeDebt,
    onSubmit: handleDisputeSubmit,
    isLoading: disputeLoading,
    error: disputeError,
    quota: disputeQuota,
  } = dispute;

  return (
      <Suspense fallback={null}>
        {isTreasurerOrTeacher && cashInOpen && (
          <LazyFastCashInModal
            dialog={{ open: cashInOpen, onOpenChange: setCashInOpen }}
            submission={{ onSubmit: handleCashInSubmit, isLoading: cashInLoading, error: cashInError }}
            options={{
              paymentMethodsError,
              nominalIuranWajib,
              paymentMethods,
              isPaymentMethodsLoading,
            }}
          />
        )}

        {isTreasurerOrTeacher && cashOutOpen && (
          <LazyTwoStageCashOutModal
            dialog={{ open: cashOutOpen, onOpenChange: setCashOutOpen }}
            balance={currentBalance}
            submission={{ onSubmit: handleCashOutSubmit, isLoading: cashOutLoading, error: cashOutError }}
          />
        )}

        {isTreasurerOrTeacher && rulesOpen && (
          <LazyBillingRulesModal
            dialog={{ open: rulesOpen, onOpenChange: setRulesOpen }}
            rules={rules}
            submission={{ onSubmit: handleBillingRulesSubmit, isLoading: billingRulesLoading, error: billingRulesError }}
          />
        )}

        {isStudent && disputeOpen && (
          <LazyStudentDisputeModal
            dialog={{ open: disputeOpen, onOpenChange: setDisputeOpen }}
            target={{ transaction: disputeTx, debt: disputeDebt, quota: disputeQuota }}
            submission={{ onSubmit: handleDisputeSubmit, isLoading: disputeLoading, error: disputeError }}
          />
        )}
      </Suspense>
  );
}
