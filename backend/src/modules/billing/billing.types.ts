export interface BillingResult {
  studentsBilled: number;
  totalNominal: number;
  status: string;
  billingWeek?: string;
}

export interface BillingRepositoryError {
  code?: string;
  message?: string;
  details?: string;
}

export interface BillingRepository {
  isConfigured(): boolean;
  generateWeeklyBilling(runDate: string): Promise<{
    data: BillingResult | null;
    error: BillingRepositoryError | null;
  }>;
}

export interface BillingLogger {
  info(payload: unknown, message?: string): void;
  warn(payload: unknown, message?: string): void;
  error(payload: unknown, message?: string): void;
}
