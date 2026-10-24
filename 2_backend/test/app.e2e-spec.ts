import { Test } from '@nestjs/testing';
import { readFile } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { configureApp } from '../dist/config/configure-app.js';
import { DATABASE_POOL } from '../dist/infrastructure/database/database.provider.js';
import type { OpenAPIObject, OperationObject } from '@nestjs/swagger';

describe('Base de la API (e2e)', () => {
  let app: INestApplication;
  const query = vi.fn();
  const pool = { query, on: vi.fn(), end: vi.fn(async () => undefined) };

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PORT', '3000');
    vi.stubEnv('FRONTEND_ORIGIN', 'http://localhost:5173');
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://postgres:test@localhost:54322/postgres',
    );
    vi.stubEnv('DATABASE_SSL', 'false');
    vi.stubEnv('DATABASE_CA_PATH', '');
    vi.stubEnv('DATABASE_POOL_MAX', '5');
    vi.stubEnv('SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    query.mockResolvedValue({ rows: [{ value: 1 }] });
    const { AppModule } = await import('../dist/app.module.js');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('expone salud bajo /api y consulta la base de datos', async () => {
    query.mockClear();
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('responde 503 sin revelar el error de conexión', async () => {
    query.mockRejectedValueOnce(
      new Error('postgresql://usuario:secreto@servidor'),
    );
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(503)
      .expect({ status: 'error', database: 'down' });
  });

  it('publica OpenAPI con el prefijo de la API', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(response.body.paths['/api/health']).toBeDefined();
    expect(response.body.components.securitySchemes.bearer).toBeDefined();
    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.servers).toEqual([
      { url: '/', description: 'Mismo origen que el servidor de la API' },
    ]);
    const saved = JSON.parse(
      await readFile(
        new URL('../openapi/openapi.json', import.meta.url),
        'utf8',
      ),
    );
    expect(response.body).toEqual(saved);
  });

  it('publica Swagger UI y la versión YAML del mismo contrato', async () => {
    await request(app.getHttpServer())
      .get('/api/docs/')
      .expect(200)
      .expect(/swagger-ui/);
    const response = await request(app.getHttpServer())
      .get('/api/docs-yaml')
      .expect(200);
    expect(response.text).toContain('openapi: 3.0.3');
    expect(response.text).toContain('/api/auth/login:');
  });

  it('documenta las operaciones con identidad estable, entradas, respuestas y seguridad', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const document = body as OpenAPIObject;
    const methods = new Set([
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'head',
      'options',
    ]);
    const ids: string[] = [];
    for (const path of Object.values(document.paths)) {
      for (const [method, value] of Object.entries(path)) {
        if (!methods.has(method)) continue;
        const operation = value as OperationObject;
        expect(operation.operationId).toBeTruthy();
        expect(operation.summary).toBeTruthy();
        expect(operation.description).toBeTruthy();
        expect(operation.tags?.length).toBeGreaterThan(0);
        ids.push(operation.operationId!);
        const successes = Object.entries(operation.responses).filter(
          ([status]) => status.startsWith('2'),
        );
        expect(successes.length).toBeGreaterThan(0);
        for (const [status, response] of successes) {
          if ('$ref' in response) continue;
          expect(response.description).toBeTruthy();
          if (status === '204') expect(response.content).toBeUndefined();
          else
            expect(response.content?.['application/json'].schema).toBeDefined();
        }
        if (operation.security?.length) {
          expect(operation.responses['401']).toBeDefined();
          expect(operation.responses['403']).toBeDefined();
        }
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(document.paths['/api/auth/login'].post?.operationId).toBe(
      'authLogin',
    );
    expect(document.paths['/api/auth/login'].post?.security).toBeUndefined();
    expect(document.paths['/api/users/invitations'].post?.security).toEqual([
      { bearer: [] },
    ]);
  });

  it('documenta los formatos reales de mensajes, errores y parámetros', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const schemas = body.components.schemas;
    expect(schemas.ApiErrorDto.properties.message.oneOf).toEqual([
      { type: 'string' },
      { type: 'array', items: { type: 'string' } },
    ]);
    expect(schemas.ApiErrorDto.required).toEqual(
      expect.arrayContaining(['statusCode', 'message']),
    );
    expect(schemas.ApiErrorDto.required).not.toContain('error');
    expect(
      body.paths['/api/auth/forgot-password'].post.responses['202'].content[
        'application/json'
      ],
    ).toMatchObject({
      schema: { $ref: '#/components/schemas/MessageDto' },
      example: {
        message: 'Si la cuenta existe, recibirás instrucciones por correo.',
      },
    });
    expect(
      body.paths['/api/users/invitations'].post.responses['202'].content[
        'application/json'
      ].schema,
    ).toEqual({ $ref: '#/components/schemas/MessageDto' });
    expect(
      body.paths['/api/health'].get.responses['503'].content['application/json']
        .schema,
    ).toEqual({ $ref: '#/components/schemas/HealthUnavailableDto' });
    expect(
      body.paths['/api/users/{id}/status'].patch.parameters,
    ).toContainEqual(
      expect.objectContaining({
        name: 'id',
        in: 'path',
        required: true,
        schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
      }),
    );
    expect(schemas.PasswordDto.properties.password).toMatchObject({
      minLength: 12,
      maxLength: 128,
      writeOnly: true,
    });
  });

  it('limita CORS al origen configurado', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200)
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173');
  });

  afterAll(async () => {
    if (app) await app.close();
    vi.unstubAllEnvs();
  });
});
