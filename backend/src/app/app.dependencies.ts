import type { FastifyInstance } from 'fastify';
import { createCoreDependencies, type CoreDependencies } from './dependencies/core.dependencies.js';
import {
  createCatalogDependencies,
  type CatalogDependencies,
} from './dependencies/catalog.dependencies.js';
import { createCashDependencies, type CashDependencies } from './dependencies/cash.dependencies.js';
import {
  createBorrowingDependencies,
  type BorrowingDependencies,
} from './dependencies/borrowing.dependencies.js';

export type AppDependencies =
  CoreDependencies
  & Omit<CatalogDependencies, 'studentsMemoryState' | 'equipmentMemoryState'>
  & CashDependencies
  & BorrowingDependencies;

/**
 * Builds the application graph once. Each dependency group has its own seam,
 * while route modules only receive the feature services they need.
 */
export function createAppDependencies(fastify: FastifyInstance): AppDependencies {
  const core = createCoreDependencies(fastify);
  const catalog = createCatalogDependencies();
  const cash = createCashDependencies(catalog);
  const borrowing = createBorrowingDependencies(catalog);

  return {
    ...core,
    studentsService: catalog.studentsService,
    dashboardService: catalog.dashboardService,
    classesService: catalog.classesService,
    usersService: catalog.usersService,
    notificationsService: catalog.notificationsService,
    equipmentService: catalog.equipmentService,
    equipmentRecoveryService: catalog.equipmentRecoveryService,
    gradesService: catalog.gradesService,
    contestsService: catalog.contestsService,
    contestEntriesService: catalog.contestEntriesService,
    contestAchievementsService: catalog.contestAchievementsService,
    filmWorksService: catalog.filmWorksService,
    accessControlService: catalog.accessControlService,
    agendaService: catalog.agendaService,
    socialMediaService: catalog.socialMediaService,
    ...cash,
    ...borrowing,
  };
}
