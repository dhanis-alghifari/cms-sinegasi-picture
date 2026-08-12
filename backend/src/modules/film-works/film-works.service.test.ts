import assert from 'node:assert/strict';
import test from 'node:test';
import { createFilmWorksRepository } from './film-works.repository.js';
import { FilmWorksService } from './film-works.service.js';

test('film works service filters the bounded memory catalog by status', async () => {
  const service = new FilmWorksService(createFilmWorksRepository(null, { films: [] }));
  const films = await service.list('selesai');
  assert.equal(films.length, 1);
  assert.equal(films[0].id, 'fw-002');
});
