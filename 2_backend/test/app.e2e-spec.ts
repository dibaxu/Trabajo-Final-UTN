import { Test } from '@nestjs/testing';
import { readFile } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { configureApp } from '../dist/config/configure-app.js';
import { DATABASE_POOL } from '../dist/infrastructure/database/database.provider.js';
import { AuthService } from '../dist/modules/auth/auth.service.js';
import { SalesService } from '../dist/modules/sales/sales.service.js';
import type { OpenAPIObject, OperationObject } from '@nestjs/swagger';

describe('Base de la API (e2e)', () => {
  let app: INestApplication;
  const query = vi.fn();
  const sales = {
    create: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    cancel: vi.fn(),
    createReturn: vi.fn(),
  };
  const release = vi.fn();
  const pool = {
    query,
    connect: vi.fn(async () => ({ query, release })),
    on: vi.fn(),
    end: vi.fn(async () => undefined),
  };

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
      .overrideProvider(AuthService)
      .useValue({
        authenticate: vi.fn(async (token: string) => ({
          id: '11111111-1111-4111-8111-111111111111',
          role: token === 'admin' ? 'ADMINISTRADOR' : 'OPERADOR',
        })),
      })
      .overrideProvider(SalesService)
      .useValue(sales)
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

  it('protege las consultas y reserva la escritura del catálogo a administradores', async () => {
    await request(app.getHttpServer()).get('/api/products').expect(401);
    await request(app.getHttpServer())
      .post('/api/product-categories')
      .set('Authorization', 'Bearer operador')
      .send({ name: 'Macetas' })
      .expect(403);
  });

  it('valida los filtros y cuerpos del catálogo antes de consultar la base', async () => {
    query.mockClear();
    const http = request(app.getHttpServer());
    await http
      .get('/api/products?status=unknown')
      .set('Authorization', 'Bearer admin')
      .expect(400);
    await http
      .get('/api/products/0')
      .set('Authorization', 'Bearer admin')
      .expect(400);
    for (const body of [
      { name: null },
      { manualCost: -1 },
      { weightGrams: 10 },
      {},
    ]) {
      await http
        .patch('/api/products/1')
        .set('Authorization', 'Bearer admin')
        .send(body)
        .expect(400);
    }
    expect(query).not.toHaveBeenCalled();
  });

  it('protege inventario y reserva ajustes e historial a administradores', async () => {
    await request(app.getHttpServer()).get('/api/stock').expect(401);
    await request(app.getHttpServer())
      .post('/api/stock/production')
      .send({ productId: 1, quantity: 1 })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/stock/movements')
      .set('Authorization', 'Bearer operador')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/stock/adjustments')
      .set('Authorization', 'Bearer operador')
      .send({
        productId: 1,
        quantity: 1,
        direction: 'INCREASE',
        reason: 'Conteo',
      })
      .expect(403);
  });

  it('rechaza filtros, fechas y cantidades inválidas antes de acceder a PostgreSQL', async () => {
    query.mockClear();
    const http = request(app.getHttpServer());
    for (const path of [
      '/api/stock?availability=other',
      '/api/stock?categoryId=0',
      '/api/stock/movements?type=OTHER',
      '/api/stock/movements?from=2026-02-30',
      '/api/stock/movements?to=2026-01-01T00:00:00Z',
      '/api/stock/movements?from=2026-11-22&to=2026-11-21',
      '/api/stock/movements?from=0000-01-01',
    ]) {
      await http.get(path).set('Authorization', 'Bearer admin').expect(400);
    }
    for (const body of [
      { productId: 0, quantity: 1 },
      { productId: 1, quantity: 0 },
      { productId: 1, quantity: -1 },
      { productId: 1, quantity: 1.5 },
      { productId: 1, quantity: 2_147_483_648 },
      { productId: 1, quantity: '1' },
      { productId: 1, quantity: 1, createdBy: 'actor' },
      { productId: 1, quantity: 1, note: 'a'.repeat(201) },
    ]) {
      await http
        .post('/api/stock/production')
        .set('Authorization', 'Bearer admin')
        .send(body)
        .expect(400);
    }
    await http
      .post('/api/stock/adjustments')
      .set('Authorization', 'Bearer admin')
      .send({ productId: 1, quantity: 1, direction: 'DECREASE', reason: '   ' })
      .expect(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('publica stock cero y transforma correctamente los filtros numéricos', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: '1',
          name: 'Maceta',
          sku: 'MAC',
          categoryId: '2',
          categoryName: 'Macetas',
          stock: '0',
        },
      ],
    });
    const { body } = await request(app.getHttpServer())
      .get('/api/stock?categoryId=2&availability=out')
      .set('Authorization', 'Bearer operador')
      .expect(200);
    expect(body).toEqual([
      {
        id: 1,
        name: 'Maceta',
        sku: 'MAC',
        categoryId: 2,
        categoryName: 'Macetas',
        stock: 0,
      },
    ]);
    expect(query).toHaveBeenLastCalledWith(expect.any(String), [
      null,
      2,
      'out',
    ]);
  });

  it('registra producción desde HTTP usando la identidad de la sesión y devuelve 201', async () => {
    query.mockClear();
    query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ is_active: true }] })
      .mockResolvedValueOnce({ rows: [] }) // Sin movimientos
      .mockResolvedValueOnce({ rows: [{ id: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            productId: '2',
            productName: 'Maceta',
            type: 'PRODUCCION',
            quantityDelta: 3,
            reason: 'Lote',
            occurredAt: new Date('2026-11-21T15:00:00Z'),
            createdBy: '11111111-1111-4111-8111-111111111111',
            createdByName: 'Pedro',
            saleId: null,
            saleItemId: null,
            returnId: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const { body } = await request(app.getHttpServer())
      .post('/api/stock/production')
      .set('Authorization', 'Bearer operador')
      .send({ productId: 2, quantity: 3, note: ' Lote ' })
      .expect(201);
    expect(body).toMatchObject({
      stockBefore: 0,
      stockAfter: 3,
      movement: {
        id: 1,
        productId: 2,
        reason: 'Lote',
        occurredAt: '2026-11-21T15:00:00.000Z',
      },
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.stock_movements'),
      [2, 'PRODUCCION', 3, 'Lote', '11111111-1111-4111-8111-111111111111'],
    );
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });

  it('responde 404, 400 y 409 sin confirmar movimientos rechazados', async () => {
    for (const scenario of [
      { product: [], status: 404 },
      { product: [{ is_active: false }], status: 400 },
      { product: [{ is_active: true }], status: 409 },
    ]) {
      query.mockClear();
      query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: scenario.product });
      if (scenario.status === 409)
        query.mockResolvedValueOnce({
          rows: [{ product_id: '1', stock: '0' }],
        });
      query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK
      await request(app.getHttpServer())
        .post('/api/stock/adjustments')
        .set('Authorization', 'Bearer admin')
        .send({
          productId: 1,
          quantity: 1,
          direction: 'DECREASE',
          reason: 'Conteo',
        })
        .expect(scenario.status);
      expect(query).toHaveBeenLastCalledWith('ROLLBACK');
      expect(query).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.anything(),
      );
    }
  });

  it('protege ventas y reserva anulaciones y devoluciones a administradores', async () => {
    await request(app.getHttpServer()).get('/api/sales').expect(401);
    await request(app.getHttpServer()).post('/api/sales').send({}).expect(401);
    await request(app.getHttpServer())
      .post('/api/sales/1/cancel')
      .set('Authorization', 'Bearer operador')
      .send({ reason: 'Error' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/sales/1/returns')
      .set('Authorization', 'Bearer operador')
      .send({ reason: 'Devuelto', items: [{ saleItemId: 1, quantity: 1 }] })
      .expect(403);
  });

  it('valida detalles anidados, tipo obligatorio y costo manual explícito', async () => {
    const item = {
      productId: 1,
      quantity: 1,
      unitPrice: 10,
      costSource: 'MANUAL',
      unitCost: 0,
    };
    for (const body of [
      { items: [item] },
      { saleType: 'MINORISTA', items: [] },
      { saleType: 'OTRO', items: [item] },
      { saleType: 'MINORISTA', items: [{ ...item, quantity: 0 }] },
      { saleType: 'MINORISTA', items: [{ ...item, unitCost: null }] },
      { saleType: 'MINORISTA', items: [{ ...item, unitPrice: 1.001 }] },
      {
        saleType: 'MINORISTA',
        items: [{ ...item, costSource: 'ESTIMACION', costEstimateId: 1 }],
      },
      { saleType: 'MINORISTA', items: [item], totalAmount: 0 },
    ]) {
      await request(app.getHttpServer())
        .post('/api/sales')
        .set('Authorization', 'Bearer admin')
        .send(body)
        .expect(400);
    }
    expect(sales.create).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get('/api/sales?from=2026-02-30')
      .set('Authorization', 'Bearer admin')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/sales/0')
      .set('Authorization', 'Bearer admin')
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/sales/1/cancel')
      .set('Authorization', 'Bearer admin')
      .send({ reason: ' ' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/sales/1/returns')
      .set('Authorization', 'Bearer admin')
      .send({ reason: 'Devuelto', items: [{ saleItemId: 1, quantity: -1 }] })
      .expect(400);
  });

  it('conecta las cinco operaciones de ventas y utiliza el usuario autenticado', async () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    const item = {
      productId: 1,
      quantity: 1,
      unitPrice: 10,
      costSource: 'MANUAL',
      unitCost: 0,
    };
    sales.create.mockResolvedValueOnce({ id: 1, status: 'CONFIRMADA' });
    await request(app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', 'Bearer operador')
      .send({ saleType: 'MINORISTA', items: [item] })
      .expect(201)
      .expect({ id: 1, status: 'CONFIRMADA' });
    expect(sales.create).toHaveBeenCalledWith(
      expect.objectContaining({ saleType: 'MINORISTA', items: [item] }),
      actorId,
    );
    sales.get.mockResolvedValueOnce({ id: 1 });
    await request(app.getHttpServer())
      .get('/api/sales/1')
      .set('Authorization', 'Bearer operador')
      .expect(200)
      .expect({ id: 1 });
    expect(sales.get).toHaveBeenCalledWith(1);
    sales.list.mockResolvedValueOnce([]);
    await request(app.getHttpServer())
      .get('/api/sales?saleType=MAYORISTA&status=ANULADA')
      .set('Authorization', 'Bearer operador')
      .expect(200)
      .expect([]);
    expect(sales.list).toHaveBeenCalledWith(
      expect.objectContaining({ saleType: 'MAYORISTA', status: 'ANULADA' }),
    );
    sales.cancel.mockResolvedValueOnce({ id: 1, status: 'ANULADA' });
    await request(app.getHttpServer())
      .post('/api/sales/1/cancel')
      .set('Authorization', 'Bearer admin')
      .send({ reason: ' Error ' })
      .expect(200);
    expect(sales.cancel).toHaveBeenCalledWith(1, 'Error', actorId);
    const returned = {
      reason: 'Devuelto',
      items: [{ saleItemId: 1, quantity: 1 }],
    };
    sales.createReturn.mockResolvedValueOnce({ id: 1, status: 'DEVUELTA' });
    await request(app.getHttpServer())
      .post('/api/sales/1/returns')
      .set('Authorization', 'Bearer admin')
      .send(returned)
      .expect(201);
    expect(sales.createReturn).toHaveBeenCalledWith(
      1,
      expect.objectContaining(returned),
      actorId,
    );
  });

  afterAll(async () => {
    if (app) await app.close();
    vi.unstubAllEnvs();
  });
});
