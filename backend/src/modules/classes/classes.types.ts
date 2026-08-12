import type { ActorSummary } from '../../shared/actors/actors.types.js';

export const CLASS_LEVEL_VALUES = ['X', 'XI', 'XII'] as const;

export type ClassLevel = typeof CLASS_LEVEL_VALUES[number];

export type ClassAccount = {
  id: string;
  nama_kelas: string;
  tingkat: ClassLevel | string;
  is_active: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  created_actor?: ActorSummary;
  updated_actor?: ActorSummary;
};

/** Minimal public selector used by forms and foreign-key inputs. */
export type ClassOption = Pick<ClassAccount, 'id' | 'nama_kelas' | 'tingkat'>;

export type ClassListQuery = {
  search?: string;
  tingkat?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
};

export type ClassListResult = {
  data: ClassAccount[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ClassCreateInput = {
  nama_kelas: string;
  tingkat: string;
};

export type ClassUpdateInput = {
  nama_kelas?: string;
  tingkat?: string;
  is_active?: boolean;
};

export type RepositoryResult<T> = { data: T } | { error: unknown };

export type ClassesMemoryState = {
  classes: ClassAccount[];
};

export interface ClassesRepository {
  isConfigured(): boolean;
  list(query: ClassListQuery): Promise<RepositoryResult<ClassListResult>>;
  listActiveOptions(): Promise<RepositoryResult<ClassOption[]>>;
  create(input: ClassCreateInput & { actorId: string | null }): Promise<RepositoryResult<ClassAccount>>;
  update(id: string, changes: ClassUpdateInput, actorId: string | null): Promise<RepositoryResult<ClassAccount | null>>;
}
