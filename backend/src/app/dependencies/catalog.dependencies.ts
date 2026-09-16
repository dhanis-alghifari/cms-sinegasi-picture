import { supabase } from '../../services/supabaseClient.js';
import { StudentService } from '../../modules/students/students.service.js';
import { createStudentRepository } from '../../modules/students/students.repository.js';
import { createStudentsMemoryState } from '../../modules/students/students.helpers.js';
import { DashboardService } from '../../modules/dashboard/dashboard.service.js';
import { createDashboardRepository } from '../../modules/dashboard/dashboard.repository.js';
import { createDashboardMemoryState } from '../../modules/dashboard/dashboard.helpers.js';
import { ClassesService } from '../../modules/classes/classes.service.js';
import { createClassesRepository } from '../../modules/classes/classes.repository.js';
import { createClassesMemoryState } from '../../modules/classes/classes.helpers.js';
import { UsersService } from '../../modules/users/users.service.js';
import { createUsersRepository } from '../../modules/users/users.repository.js';
import { createUsersMemoryState } from '../../modules/users/users.helpers.js';
import { NotificationsService } from '../../modules/notifications/notifications.service.js';
import { createNotificationsRepository } from '../../modules/notifications/notifications.repository.js';
import { createNotificationMemoryState } from '../../modules/notifications/notifications.helpers.js';
import { EquipmentService } from '../../modules/equipment/equipment.service.js';
import { createEquipmentRepository } from '../../modules/equipment/equipment.repository.js';
import { createEquipmentMemoryState } from '../../modules/equipment/equipment.helpers.js';
import { GradesService } from '../../modules/grades/grades.service.js';
import { createGradesRepository, type GradesMemoryState } from '../../modules/grades/grades.repository.js';
import { ContestsService } from '../../modules/contests/contests.service.js';
import { createContestsRepository } from '../../modules/contests/contests.repository.js';
import type { ContestMemoryState } from '../../modules/contests/contests.types.js';
import { FilmWorksService } from '../../modules/film-works/film-works.service.js';
import { createFilmWorksRepository } from '../../modules/film-works/film-works.repository.js';
import { AccessControlService } from '../../modules/access-control/access-control.service.js';
import { createAccessControlMemoryState, createAccessControlRepository } from '../../modules/access-control/access-control.repository.js';
import { ContestEntriesService } from '../../modules/contest-entries/contest-entries.service.js';
import { createContestEntriesRepository } from '../../modules/contest-entries/contest-entries.repository.js';
import type { ContestEntriesMemoryState } from '../../modules/contest-entries/contest-entries.types.js';
import { ContestAchievementsService } from '../../modules/contest-achievements/contest-achievements.service.js';
import { createContestAchievementsRepository } from '../../modules/contest-achievements/contest-achievements.repository.js';
import type { ContestAchievementsMemoryState } from '../../modules/contest-achievements/contest-achievements.types.js';
import { EquipmentRecoveryService } from '../../modules/equipment/equipment.recovery.service.js';
import { createEquipmentRecoveryRepository } from '../../modules/equipment/equipment.recovery.repository.js';
import { createEquipmentRecoveryMemoryState } from '../../modules/equipment/equipment.recovery.helpers.js';

export interface CatalogDependencies {
  studentsService: StudentService;
  dashboardService: DashboardService;
  classesService: ClassesService;
  usersService: UsersService;
  notificationsService: NotificationsService;
  equipmentService: EquipmentService;
  equipmentRecoveryService: EquipmentRecoveryService;
  gradesService: GradesService;
  contestsService: ContestsService;
  contestEntriesService: ContestEntriesService;
  contestAchievementsService: ContestAchievementsService;
  filmWorksService: FilmWorksService;
  accessControlService: AccessControlService;
  studentsMemoryState: ReturnType<typeof createStudentsMemoryState>;
  equipmentMemoryState: ReturnType<typeof createEquipmentMemoryState>;
}

/** Builds catalog, academic, and account feature adapters in one local seam. */
export function createCatalogDependencies(): CatalogDependencies {
  const studentsMemoryState = createStudentsMemoryState();
  const dashboardMemoryState = createDashboardMemoryState();
  const classesMemoryState = createClassesMemoryState();
  const usersMemoryState = createUsersMemoryState();
  const notificationMemoryState = createNotificationMemoryState();
  const equipmentMemoryState = createEquipmentMemoryState();
  const equipmentRecoveryMemoryState = createEquipmentRecoveryMemoryState();
  const gradesState: GradesMemoryState = { grades: [], assignments: [] };
  const contestsState: ContestMemoryState = { contests: [], submissions: [] };
  const contestEntriesState: ContestEntriesMemoryState = { works: [], entries: [], statusHistory: [] };
  const contestAchievementsState: ContestAchievementsMemoryState = { achievements: [] };
  const filmWorksState = { films: [] };
  const accessControlState = createAccessControlMemoryState();

  return {
    studentsService: new StudentService(
      createStudentRepository(supabase, studentsMemoryState),
      () => studentsMemoryState.students,
    ),
    dashboardService: new DashboardService(createDashboardRepository(dashboardMemoryState, supabase)),
    classesService: new ClassesService(createClassesRepository(supabase, classesMemoryState)),
    usersService: new UsersService(createUsersRepository(supabase, usersMemoryState)),
    notificationsService: new NotificationsService(
      createNotificationsRepository(supabase, notificationMemoryState),
    ),
    equipmentService: new EquipmentService(createEquipmentRepository(supabase, equipmentMemoryState)),
    equipmentRecoveryService: new EquipmentRecoveryService(createEquipmentRecoveryRepository(supabase, equipmentRecoveryMemoryState, equipmentMemoryState)),
    gradesService: new GradesService(createGradesRepository(supabase, gradesState)),
    contestsService: new ContestsService(createContestsRepository(supabase, contestsState)),
    contestEntriesService: new ContestEntriesService(createContestEntriesRepository(supabase, contestEntriesState)),
    contestAchievementsService: new ContestAchievementsService(createContestAchievementsRepository(supabase, contestAchievementsState)),
    filmWorksService: new FilmWorksService(createFilmWorksRepository(supabase, filmWorksState)),
    accessControlService: new AccessControlService(createAccessControlRepository(supabase, accessControlState)),
    studentsMemoryState,
    equipmentMemoryState,
  };
}
