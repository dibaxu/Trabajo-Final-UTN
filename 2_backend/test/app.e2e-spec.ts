import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { configureApp } from '../src/config/configure-app.js';
import { DATABASE_POOL } from '../src/infrastructure/database/database.provider.js';

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
    query.mockResolvedValue({ rows: [{ value: 1 }] });
    const { AppModule } = await import('../src/app.module.js');
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
