import 'reflect-metadata';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { createOpenApiDocument } from '../dist/config/openapi.js';
import { configureApp } from '../dist/config/configure-app.js';

// Solo metadatos HTTP: no iniciar la app, abrir un puerto ni ejecutar sus hooks de conexión.
// Estos valores ficticios permiten generar el contrato sin credenciales de Supabase ni PostgreSQL.
Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3000',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  DATABASE_URL:
    'postgresql://documentation:documentation@127.0.0.1:1/documentation',
  DATABASE_SSL: 'false',
  DATABASE_CA_PATH: '',
  DATABASE_POOL_MAX: '1',
  SUPABASE_URL: 'http://127.0.0.1:1',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_documentation',
  SUPABASE_SECRET_KEY: 'sb_secret_documentation',
});

const { AppModule } = await import('../dist/app.module.js');
const app = await NestFactory.create(AppModule, { logger: false });
try {
  configureApp(app);
  const document = createOpenApiDocument(app);
  const content = `${JSON.stringify(document, null, 2)}\n`;
  const directory = new URL('../openapi/', import.meta.url);
  const output = new URL('openapi.json', directory);
  if (process.argv.includes('--check')) {
    const existing = await readFile(output, 'utf8').catch(() => '');
    if (existing !== content) {
      throw new Error(
        'El contrato OpenAPI está desactualizado. Ejecutá npm run openapi:generate y revisá el diff.',
      );
    }
    console.log('Contrato OpenAPI actualizado.');
  } else {
    await mkdir(directory, { recursive: true });
    await writeFile(output, content);
    console.log('Contrato generado en openapi/openapi.json.');
  }
} finally {
  await app.close();
}
