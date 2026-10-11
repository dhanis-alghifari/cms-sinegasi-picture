import type { ReportPrintFormat } from '@/shared/types/report';
import type { PaginatedResponse } from '@/shared/types/common';
import type { StudentOption } from '@/features/students/types/students.types';

import type {
  CashDisputeQuota,
  CashPaymentMethod,
  CashReport,
  CashTransaction,
  DebtRecord,
} from '../types/cash.types';
import type { CashReportPreset } from '../utils/reportDates';

export type CashView = 'activity' | 'transactions' | 'debts' | 'disputes' | 'report';

export type CashPageTabsProps = {
  navigation: {
    currentView: CashView;
    isTreasurerOrTeacher: boolean;
    isStudent: boolean;
    canReviewDisputes: boolean;
    canReadAllDisputes: boolean;
    canReadOwnDisputes: boolean;
    isMobile: boolean;
    pageSize: number;
    onChange: (view: CashView) => void;
  };
  paymentMethods: {
    items: CashPaymentMethod[];
    isLoading: boolean;
  };
  transactions: {
    data?: PaginatedResponse<CashTransaction>;
    isLoading: boolean;
    error?: unknown;
    page: number;
    onRetry: () => void;
    onPageChange: (page: number) => void;
  };
  transactionFilters: {
    startDate: string;
    endDate: string;
    paymentMethod: string;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onPaymentMethodChange: (value: string) => void;
    onReset: () => void;
  };
  studentScope: {
    canFilter: boolean;
    selectedStudent: StudentOption | null;
    options: StudentOption[];
    isLoading: boolean;
    error?: unknown;
    onValueChange: (studentId: string) => void;
    onSelectedStudentChange: (student: StudentOption | null) => void;
    onSearchChange: (value: string) => void;
    onClear: () => void;
    onRetry: () => void;
  };
  debts: {
    data?: PaginatedResponse<DebtRecord>;
    isLoading: boolean;
    error?: unknown;
    page: number;
    onRetry: () => void;
    onPageChange: (page: number) => void;
    outstandingAmount: number;
  };
  report: {
    data?: CashReport;
    isLoading: boolean;
    error?: unknown;
    rangeError?: string;
    startDate: string;
    endDate: string;
    paymentMethod: string;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onPaymentMethodChange: (value: string) => void;
    onPreset: (days: CashReportPreset) => void;
    onExportCsv: (report: CashReport) => void;
    onPrintPdf: (format: ReportPrintFormat) => void;
  };
  actions: {
    onDisputeTransaction: (transaction: CashTransaction) => void;
    onDisputeDebt: (debt: DebtRecord) => void;
    disputeQuota?: CashDisputeQuota;
  };
};
