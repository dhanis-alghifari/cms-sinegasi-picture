import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PersistAuditLog } from '../../shared/audit/audit-route.types.js';
import cashReadRoutes from './ledger/cash.read.routes.js';
import cashMutationsRoutes from './ledger/cash.mutations.routes.js';
import { CashReadService } from './ledger/cash.read.service.js';
import { createCashReadRepository } from './ledger/cash.read.repository.js';
import { CashMutationsService } from './ledger/cash.mutations.service.js';
import { createCashMutationsRepository } from './ledger/cash.mutations.repository.js';
import cashReportingRoutes from './reports/cash.reporting.routes.js';
import { CashReportingService } from './reports/cash.reporting.service.js';
import { createCashReportingRepository } from './reports/cash.reporting.repository.js';
import cashPaymentMethodsRoutes from './payment-methods/cash.payment-methods.routes.js';
import { CashPaymentMethodsService } from './payment-methods/cash.payment-methods.service.js';
import { createCashPaymentMethodsRepository } from './payment-methods/cash.payment-methods.repository.js';
import cashDisputesRoutes from './disputes/cash.disputes.routes.js';
import { CashDisputesService } from './disputes/cash.disputes.service.js';
import { createCashDisputesRepository } from './disputes/cash.disputes.repository.js';
import type { CashStudentSnapshot } from './shared/cash.types.js';
import type { CashMemoryState } from './shared/cash.memory.js';

export type CashSupabaseClient = SupabaseClient | null;

export interface CashModule {
  readService: CashReadService;
  mutationsService: CashMutationsService;
  reportingService: CashReportingService;
  paymentMethodsService: CashPaymentMethodsService;
  disputesService: CashDisputesService;
}

/**
 * Public seam for the cash domain. The application composition root only needs
 * this factory; repository choices and the shared local adapter stay private
 * to the module implementation.
 */
export function createCashModule(
  client: CashSupabaseClient,
  memory: CashMemoryState,
  students: readonly CashStudentSnapshot[],
): CashModule {
  return {
    readService: new CashReadService(createCashReadRepository(client, {
      transactions: memory.transactions,
      students,
      debts: memory.debts,
    })),
    mutationsService: new CashMutationsService(createCashMutationsRepository(client, {
      transactions: memory.transactions,
      debts: memory.debts,
      students,
      paymentMethods: memory.paymentMethods,
      billingRules: memory.billingRules,
    })),
    reportingService: new CashReportingService(createCashReportingRepository(client, {
      transactions: memory.transactions,
      debts: memory.debts,
      students,
      paymentMethods: memory.paymentMethods,
      billingRules: memory.billingRules,
    })),
    paymentMethodsService: new CashPaymentMethodsService(
      createCashPaymentMethodsRepository(client, memory.paymentMethods),
    ),
    disputesService: new CashDisputesService(createCashDisputesRepository(client, {
      transactions: memory.transactions,
    })),
  };
}

/** Registers all cash route families behind one application-level seam. */
export async function registerCashRoutes(
  fastify: FastifyInstance,
  module: CashModule,
  persistAuditLog: PersistAuditLog,
): Promise<void> {
  await fastify.register(cashReadRoutes, { cashReadService: module.readService });
  await fastify.register(cashPaymentMethodsRoutes, {
    paymentMethodsService: module.paymentMethodsService,
    persistAuditLog,
  });
  await fastify.register(cashMutationsRoutes, { cashMutationsService: module.mutationsService });
  await fastify.register(cashReportingRoutes, {
    reportingService: module.reportingService,
    persistAuditLog,
  });
  await fastify.register(cashDisputesRoutes, {
    disputesService: module.disputesService,
    persistAuditLog,
  });
}
