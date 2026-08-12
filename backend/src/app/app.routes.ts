import type { FastifyInstance } from 'fastify';
import { registerCoreRoutes } from './routes/core.routes.js';
import { registerCatalogRoutes } from './routes/catalog.routes.js';
import { registerCashRoutes } from '../modules/cash/cash.module.js';
import { registerBorrowingRoutes } from './routes/borrowing.routes.js';
import type { AppDependencies } from './app.dependencies.js';

/** Registers route groups after global hooks have been attached. */
export async function registerAppRoutes(
  fastify: FastifyInstance,
  dependencies: AppDependencies,
): Promise<void> {
  await registerCoreRoutes(fastify, dependencies);
  await registerCatalogRoutes(fastify, dependencies);
  await registerCashRoutes(fastify, dependencies.cash, dependencies.persistAuditLog);
  await registerBorrowingRoutes(fastify, dependencies);
}
