import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import test from 'node:test';
import filmWorksRoutes from './film-works.routes.js';
import { FilmWorksService } from './film-works.service.js';
import { createFilmWorksRepository } from './film-works.repository.js';

test('film works route keeps authenticated response envelope', async (t) => {
  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret-that-is-long-enough' });
  await app.register(filmWorksRoutes, { filmWorksService: new FilmWorksService(createFilmWorksRepository(null, { films: [] })) });
  t.after(() => app.close());
  const token = app.jwt.sign({ userId: 'teacher-1', username: 'teacher', role: 'teacher', isFirstLogin: false });
  const response = await app.inject({ method: 'GET', url: '/api/film-works?status=selesai', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().total, 1);
});
