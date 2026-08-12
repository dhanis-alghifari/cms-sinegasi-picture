import { normalizeFilmStatus } from './film-works.helpers.js';
import type { FilmWorksRepository } from './film-works.types.js';
import { databaseErrorCode } from '../../shared/database/database.types.js';

export class FilmWorksServiceError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); this.name = 'FilmWorksServiceError'; }
}

export class FilmWorksService {
  constructor(private readonly repository: FilmWorksRepository) {}

  async list(status?: string) {
    const normalizedStatus = normalizeFilmStatus(status);
    const result = await this.repository.list(normalizedStatus);
    if ('error' in result) {
      const code = databaseErrorCode(result.error);
      const missingSchema = code === '42P01' || code === 'PGRST205';
      throw new FilmWorksServiceError(missingSchema ? 503 : 500, missingSchema ? 'Skema karya film belum terpasang.' : 'Gagal memuat daftar karya film.');
    }
    return result.data;
  }
}
