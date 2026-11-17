import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './config/configure-app.js';
import type { Environment } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  const config = app.get(ConfigService<Environment, true>);
  await app.listen(config.get('PORT', { infer: true }));
}
// Vercel espera a que termine import(main) antes de abrir el servidor capturado.
// Esperar bootstrap() en el nivel superior bloquearía ese ciclo de arranque.
void bootstrap().catch((error: unknown) => {
  console.error('No se pudo iniciar la API.', error);
  process.exit(1);
});
