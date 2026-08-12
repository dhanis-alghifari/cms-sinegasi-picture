import { runtimeConfig } from './config/env.js';
import { createApplication } from './app/createApplication.js';

async function main(): Promise<void> {
  const runtime = await createApplication();
  await runtime.app.listen({ port: runtimeConfig.port, host: runtimeConfig.host });
  runtime.startWorkers();
  runtime.app.log.info({
    host: runtimeConfig.host,
    port: runtimeConfig.port,
  }, 'Fastify backend server started');
}

void main().catch((error: unknown) => {
  console.error('Fastify backend failed to start', error);
  process.exitCode = 1;
});
