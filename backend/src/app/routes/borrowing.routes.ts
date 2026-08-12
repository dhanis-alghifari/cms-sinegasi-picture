import type { FastifyInstance } from 'fastify';
import borrowingReadRoutes from '../../modules/borrowing/borrowing.read.routes.js';
import borrowingMutationsRoutes from '../../modules/borrowing/borrowing.mutations.routes.js';
import type { AppDependencies } from '../app.dependencies.js';

export async function registerBorrowingRoutes(
  fastify: FastifyInstance,
  dependencies: AppDependencies,
): Promise<void> {
  await fastify.register(borrowingReadRoutes, {
    borrowingReadService: dependencies.borrowingReadService,
  });
  await fastify.register(borrowingMutationsRoutes, {
    borrowingMutationsService: dependencies.borrowingMutationsService,
  });
}
