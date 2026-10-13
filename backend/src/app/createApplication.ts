import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { runtimeConfig } from '../config/env.js';
import { createProxyTrust } from '../config/proxyTrust.js';
import { startOverdueWorker } from '../workers/overdueWorker.js';
import { startWeeklyBillingWorker } from '../workers/weeklyBillingWorker.js';
import { createBackgroundJobs } from '../workers/backgroundJobs.js';
import { createAppDependencies } from './app.dependencies.js';
import { registerAppHooks } from './app.hooks.js';
import { registerAppRoutes } from './app.routes.js';

export interface ApplicationRuntime {
  app: FastifyInstance;
  startWorkers(): void;
}

/**
 * Composition root for HTTP concerns. This function owns plugin order and
 * lifecycle only; feature behavior remains inside its module seam.
 */
export async function createApplication(): Promise<ApplicationRuntime> {
  const app = Fastify({
    logger: {
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', 'password', 'password_hash', 'temporary_password', 'token'],
        censor: '[REDACTED]',
      },
    },
    bodyLimit: 2 * 1024 * 1024,
    requestTimeout: 30_000,
    connectionTimeout: 10_000,
    trustProxy: createProxyTrust(runtimeConfig),
  });
  const dependencies = createAppDependencies(app);
  const workers = createBackgroundJobs(runtimeConfig.backgroundJobsEnabled, () => {
    const overdueWorkerTimer = startOverdueWorker(app, dependencies.overdueService);
    try {
      const billingWorker = startWeeklyBillingWorker(app, dependencies.billingService);
      return () => { clearInterval(overdueWorkerTimer); billingWorker.stop(); };
    } catch (error) {
      clearInterval(overdueWorkerTimer);
      throw error;
    }
  });

  await app.register(cors, {
    origin: runtimeConfig.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 'Authorization', 'X-Change-Reason', 'X-Idempotency-Key',
      'x-change-reason', 'x-idempotency-key',
    ],
    credentials: true,
  });
  await app.register(jwt, { secret: runtimeConfig.jwtSecret });
  registerAppHooks(app);
  await registerAppRoutes(app, dependencies);

  app.addHook('onClose', async () => {
    workers.stop();
  });

  return {
    app,
    startWorkers: workers.start,
  };
}
