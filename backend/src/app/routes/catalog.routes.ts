import type { FastifyInstance } from 'fastify';
import studentRoutes from '../../modules/students/students.routes.js';
import dashboardRoutes from '../../modules/dashboard/dashboard.routes.js';
import classesRoutes from '../../modules/classes/classes.routes.js';
import usersRoutes from '../../modules/users/users.routes.js';
import notificationsRoutes from '../../modules/notifications/notifications.routes.js';
import equipmentRoutes from '../../modules/equipment/equipment.routes.js';
import gradesRoutes from '../../modules/grades/grades.routes.js';
import contestsRoutes from '../../modules/contests/contests.routes.js';
import filmWorksRoutes from '../../modules/film-works/film-works.routes.js';
import accessControlRoutes from '../../modules/access-control/access-control.routes.js';
import type { AppDependencies } from '../app.dependencies.js';
import contestEntriesRoutes from '../../modules/contest-entries/contest-entries.routes.js';
import contestAchievementsRoutes from '../../modules/contest-achievements/contest-achievements.routes.js';
import agendaRoutes from '../../modules/agenda/agenda.routes.js';
import socialMediaRoutes from '../../modules/social-media/social-media.routes.js';

export async function registerCatalogRoutes(
  fastify: FastifyInstance,
  dependencies: AppDependencies,
): Promise<void> {
  await fastify.register(studentRoutes, {
    studentsService: dependencies.studentsService,
    persistAuditLog: dependencies.persistAuditLog,
  });
  await fastify.register(dashboardRoutes, { dashboardService: dependencies.dashboardService });
  await fastify.register(classesRoutes, {
    classesService: dependencies.classesService,
    persistAuditLog: dependencies.persistAuditLog,
  });
  await fastify.register(usersRoutes, {
    usersService: dependencies.usersService,
    persistAuditLog: dependencies.persistAuditLog,
  });
  await fastify.register(notificationsRoutes, {
    notificationsService: dependencies.notificationsService,
  });
  await fastify.register(equipmentRoutes, {
    equipmentService: dependencies.equipmentService,
    equipmentRecoveryService: dependencies.equipmentRecoveryService,
    persistAuditLog: dependencies.persistAuditLog,
  });
  await fastify.register(gradesRoutes, {
    gradesService: dependencies.gradesService,
    persistAuditLog: dependencies.persistAuditLog,
  });
  await fastify.register(contestsRoutes, {
    contestsService: dependencies.contestsService,
    persistAuditLog: dependencies.persistAuditLog,
  });
  await fastify.register(contestEntriesRoutes, {
    contestEntriesService: dependencies.contestEntriesService,
    persistAuditLog: dependencies.persistAuditLog,
  });
  await fastify.register(contestAchievementsRoutes, {
    contestAchievementsService: dependencies.contestAchievementsService,
  });
  await fastify.register(filmWorksRoutes, { filmWorksService: dependencies.filmWorksService });
  await fastify.register(accessControlRoutes, { accessControlService: dependencies.accessControlService });
  await fastify.register(agendaRoutes, { agendaService: dependencies.agendaService });
  await fastify.register(socialMediaRoutes, { socialMediaService: dependencies.socialMediaService, persistAuditLog: dependencies.persistAuditLog });
}
