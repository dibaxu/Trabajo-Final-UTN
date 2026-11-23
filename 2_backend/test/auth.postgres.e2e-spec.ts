import { readFile } from 'node:fs/promises';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from '../dist/infrastructure/database/database.service.js';
import { AuthRepository } from '../dist/modules/auth/auth.repository.js';
import { ProductsService } from '../dist/modules/products/products.service.js';
import { InventoryService } from '../dist/modules/inventory/inventory.service.js';
import { SalesService } from '../dist/modules/sales/sales.service.js';

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const pending = '33333333-3333-4333-8333-333333333333';
const sid = '44444444-4444-4444-8444-444444444444';

describe.skipIf(!databaseUrl)(
  'Acceso, catálogo, inventario y ventas en PostgreSQL real aislado',
  () => {
    let pool: Pool;
    let repository: AuthRepository;
    let products: ProductsService;
    let inventory: InventoryService;
    let sales: SalesService;
    let ownsSchema = false;

    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        url.pathname !== '/auth_test'
      ) {
        throw new Error(
          'Las pruebas requieren una base local vacía llamada auth_test.',
        );
      }
      pool = new Pool({ connectionString: databaseUrl });
      const existing = await pool.query(
        "SELECT to_regclass('public.profiles') AS profiles, to_regnamespace('auth') AS auth",
      );
      const publicObjects = await pool.query(`SELECT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      UNION ALL SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
    ) AS present`);
      if (
        existing.rows[0].profiles ||
        existing.rows[0].auth ||
        publicObjects.rows[0].present
      )
        throw new Error('La base auth_test debe estar vacía.');
      ownsSchema = true;
      // Contrato mínimo de las tablas administradas por Supabase. No pretende simular su motor Auth.
      await pool.query(`CREATE SCHEMA auth;
      DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END $$;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text UNIQUE, email_confirmed_at timestamptz);
      CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id), not_after timestamptz);`);
      for (const file of [
        '20261009231732_schema_inicial.sql',
        '20261017211747_acceso_por_invitacion.sql',
        '20261117000442_catalogo_productos.sql',
        '20261121200218_inventario_movimientos.sql',
        '20261122133649_ventas_anulaciones_devoluciones.sql',
      ]) {
        await pool.query(
          await readFile(
            new URL(`../supabase/migrations/${file}`, import.meta.url),
            'utf8',
          ),
        );
      }
      const database = new DatabaseService(pool);
      repository = new AuthRepository(database);
      inventory = new InventoryService(database);
      products = new ProductsService(database, inventory);
      sales = new SalesService(database, inventory);
    });

    beforeEach(async () => {
      await pool.query(
        'TRUNCATE public.sales, public.stock_movements, public.products, public.product_categories, public.profiles, auth.sessions, auth.users CASCADE',
      );
      await pool.query(
        `INSERT INTO auth.users VALUES ($1, 'a@example.com', now()), ($2, 'b@example.com', now()), ($3, 'pending@example.com', NULL)`,
        [a, b, pending],
      );
      await pool.query(
        `INSERT INTO public.profiles (id, role_id, display_name)
      SELECT u.id, r.id, u.email FROM auth.users u CROSS JOIN public.roles r
      WHERE r.code = 'ADMINISTRADOR' AND u.id IN ($1, $2)`,
        [a, b],
      );
    });

    it('provisiona solo el rol elegido por el servidor', async () => {
      await repository.provisionMember(pending, 'Persona', a);
      expect(await repository.findMember(pending)).toMatchObject({
        role: 'ADMINISTRADOR',
        isActive: true,
        emailConfirmed: false,
        invitedBy: a,
        displayName: 'Persona',
      });
    });

    it('un reintento no cambia el invitador, nombre ni estado del perfil', async () => {
      await repository.provisionMember(pending, 'Primero', a);
      await repository.provisionMember(pending, 'Segundo', b);
      expect(await repository.findMember(pending)).toMatchObject({
        displayName: 'Primero',
        invitedBy: a,
      });
      await repository.setStatus(a, pending, false);
      await expect(
        repository.provisionMember(pending, 'Segundo', b),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect((await repository.findMember(pending))?.isActive).toBe(false);
    });

    it('no crea perfiles en nombre de un administrador desactivado', async () => {
      await repository.setStatus(a, b, false);
      await expect(
        repository.provisionMember(pending, 'Persona', b),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await repository.findMember(pending)).toBeUndefined();
    });

    it('comprueba la sesión, su usuario y su vencimiento y detecta la revocación', async () => {
      await pool.query(
        'INSERT INTO auth.sessions (id, user_id) VALUES ($1, $2)',
        [sid, a],
      );
      expect(await repository.isSessionActive(a, sid)).toBe(true);
      expect(await repository.isSessionActive(b, sid)).toBe(false);
      await pool.query(
        "UPDATE auth.sessions SET not_after = now() - interval '1 minute'",
      );
      expect(await repository.isSessionActive(a, sid)).toBe(false);
      await pool.query('DELETE FROM auth.sessions');
      expect(await repository.isSessionActive(a, sid)).toBe(false);
    });

    it('impide desactivar el propio acceso', async () => {
      await expect(repository.setStatus(a, a, false)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect((await repository.findMember(a))?.isActive).toBe(true);
    });

    it('conserva un administrador activo ante desactivaciones simultáneas', async () => {
      const results = await Promise.allSettled([
        repository.setStatus(a, b, false),
        repository.setStatus(b, a, false),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        (await repository.listMembers()).filter((member) => member.isActive),
      ).toHaveLength(1);
    });

    it('permite reactivar explícitamente un perfil sin cambiar su identidad', async () => {
      await repository.setStatus(a, b, false);
      const result = await repository.setStatus(a, b, true);
      expect(result).toMatchObject({
        id: b,
        isActive: true,
        role: 'ADMINISTRADOR',
      });
    });

    it('mantiene RLS y los permisos bloqueados para clientes de la Data API', async () => {
      const rls = await pool.query(
        "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass",
      );
      expect(rls.rows[0].relrowsecurity).toBe(true);
      const privilege = await pool.query(
        "SELECT has_table_privilege('authenticated', 'public.profiles', 'SELECT') AS allowed",
      );
      expect(privilege.rows[0].allowed).toBe(false);
    });

    it('persiste el catálogo, filtra por SKU y estado y conserva campos omitidos', async () => {
      const category = await products.createCategory({ name: 'Macetas' });
      const product = await products.createProduct(
        {
          name: 'Maceta geométrica',
          sku: 'MAC-01',
          categoryId: category.id,
          manualCost: 10.25,
        },
        a,
      );
      expect(product).toMatchObject({
        categoryName: 'Macetas',
        manualCost: 10.25,
        referenceSalePrice: 0,
        imageUrl: null,
        stock: 0,
      });
      await products.updateCategory(category.id, { isActive: false });
      const edited = await products.updateProduct(product.id, {
        categoryId: category.id,
        manualCost: null,
      });
      expect(edited).toMatchObject({ manualCost: null, sku: 'MAC-01' });
      await expect(
        products.createProduct({ name: 'Otra', categoryId: category.id }, a),
      ).rejects.toBeInstanceOf(BadRequestException);
      await products.setProductStatus(product.id, false);
      const matching = await products.listProducts({
        search: 'mac-01',
        categoryId: category.id,
        status: 'inactive',
      });
      expect(matching.map(({ id }) => id)).toEqual([product.id]);
      expect(await products.listProducts({ status: 'active' })).toEqual([]);
      expect(await products.getProduct(product.id)).toMatchObject({
        isActive: false,
      });
    });

    it('garantiza unicidad de categorías y SKU sin distinguir mayúsculas con escrituras simultáneas', async () => {
      const category = await products.createCategory({ name: 'Macetas' });
      await expect(
        products.createCategory({ name: 'macetas' }),
      ).rejects.toBeInstanceOf(ConflictException);
      const results = await Promise.allSettled([
        products.createProduct(
          { name: 'Primero', categoryId: category.id, sku: 'MAC-01' },
          a,
        ),
        products.createProduct(
          { name: 'Segundo', categoryId: category.id, sku: 'mac-01' },
          b,
        ),
      ]);
      expect(
        results.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(results).toContainEqual(
        expect.objectContaining({
          status: 'rejected',
          reason: expect.any(ConflictException),
        }),
      );
      expect(await products.listProducts({})).toHaveLength(1);
    });

    it('registra producción y ajustes conservando el saldo del catálogo y el historial', async () => {
      const category = await products.createCategory({ name: 'Macetas' });
      const product = await products.createProduct(
        { name: 'Maceta', sku: 'MAC', categoryId: category.id },
        a,
      );
      const empty = await products.createProduct(
        { name: 'Sin producir', categoryId: category.id },
        a,
      );
      expect(await inventory.listStock({ availability: 'out' })).toHaveLength(
        2,
      );
      expect(await inventory.getBalances([product.id, empty.id])).toEqual(
        new Map([
          [product.id, 0],
          [empty.id, 0],
        ]),
      );
      const production = await inventory.registerProduction(
        { productId: product.id, quantity: 10, note: ' Lote PLA ' },
        a,
      );
      expect(production).toMatchObject({
        stockBefore: 0,
        stockAfter: 10,
        movement: {
          productId: product.id,
          type: 'PRODUCCION',
          quantityDelta: 10,
          reason: 'Lote PLA',
          createdBy: a,
        },
      });
      const adjustment = await inventory.adjustStock(
        {
          productId: product.id,
          quantity: 2,
          direction: 'DECREASE',
          reason: 'Daños',
        },
        b,
      );
      expect(adjustment).toMatchObject({
        stockBefore: 10,
        stockAfter: 8,
        movement: { quantityDelta: -2 },
      });
      await inventory.adjustStock(
        {
          productId: product.id,
          quantity: 1,
          direction: 'INCREASE',
          reason: 'Conteo',
        },
        a,
      );
      expect(await products.getProduct(product.id)).toMatchObject({ stock: 9 });
      expect(
        (await products.listProducts({})).find(({ id }) => id === product.id)
          ?.stock,
      ).toBe(9);
      expect(
        await inventory.listStock({
          search: 'mac',
          categoryId: category.id,
          availability: 'available',
        }),
      ).toEqual([expect.objectContaining({ id: product.id, stock: 9 })]);
      expect(
        await inventory.listMovements({ productId: product.id }),
      ).toHaveLength(3);
      expect(
        await inventory.listMovements({ type: 'AJUSTE_NEGATIVO' }),
      ).toEqual([expect.objectContaining({ createdBy: b, quantityDelta: -2 })]);
      await products.setProductStatus(product.id, false);
      expect(await inventory.listStock({ availability: 'available' })).toEqual(
        [],
      );
      expect(
        await inventory.listMovements({ productId: product.id }),
      ).toHaveLength(3);
    });

    it('serializa reducciones simultáneas y revierte operaciones fallidas', async () => {
      const category = await products.createCategory({ name: 'Macetas' });
      const product = await products.createProduct(
        { name: 'Maceta', categoryId: category.id },
        a,
      );
      await inventory.registerProduction(
        { productId: product.id, quantity: 5 },
        a,
      );
      const input = {
        productId: product.id,
        quantity: 4,
        direction: 'DECREASE' as const,
        reason: 'Conteo',
      };
      const results = await Promise.allSettled([
        inventory.adjustStock(input, a),
        inventory.adjustStock(input, b),
      ]);
      expect(
        results.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(results).toContainEqual(
        expect.objectContaining({
          status: 'rejected',
          reason: expect.any(ConflictException),
        }),
      );
      expect((await products.getProduct(product.id)).stock).toBe(1);
      expect(await inventory.listMovements({})).toHaveLength(2);
      // La FK falla después del cálculo del saldo; la transacción debe revertirse.
      await expect(
        inventory.registerProduction(
          { productId: product.id, quantity: 10 },
          pending,
        ),
      ).rejects.toMatchObject({ code: '23503' });
      expect((await products.getProduct(product.id)).stock).toBe(1);
      expect(await inventory.listMovements({})).toHaveLength(2);
    });

    it('coordina producciones simultáneas y conserva saldos numéricos mayores que integer', async () => {
      const category = await products.createCategory({ name: 'Macetas' });
      const product = await products.createProduct(
        { name: 'Maceta', categoryId: category.id },
        a,
      );
      const results = await Promise.all([
        inventory.registerProduction(
          { productId: product.id, quantity: 2_147_483_647 },
          a,
        ),
        inventory.registerProduction({ productId: product.id, quantity: 1 }, b),
      ]);
      expect(
        results
          .map(({ stockAfter }) => stockAfter)
          .sort((x, y) => x - y)
          .at(-1),
      ).toBe(2_147_483_648);
      expect((await products.getProduct(product.id)).stock).toBe(2_147_483_648);
    });

    it('rechaza productos inexistentes e inactivos sin registrar movimientos', async () => {
      await expect(
        inventory.registerProduction(
          { productId: Number.MAX_SAFE_INTEGER, quantity: 1 },
          a,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      const category = await products.createCategory({ name: 'Macetas' });
      const product = await products.createProduct(
        { name: 'Maceta', categoryId: category.id, isActive: false },
        a,
      );
      await expect(
        inventory.registerProduction({ productId: product.id, quantity: 1 }, a),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        inventory.adjustStock(
          {
            productId: product.id,
            quantity: 1,
            direction: 'INCREASE',
            reason: 'Conteo',
          },
          a,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(await inventory.listMovements({})).toEqual([]);
    });

    it('filtra días completos de Buenos Aires y ordena empates por identificador', async () => {
      const category = await products.createCategory({ name: 'Macetas' });
      const product = await products.createProduct(
        { name: 'Maceta', categoryId: category.id },
        a,
      );
      await pool.query(
        `INSERT INTO public.stock_movements (product_id, movement_type, quantity_delta, occurred_at, created_by)
         SELECT $1, 'PRODUCCION', 1, instant::timestamptz, $2 FROM unnest(ARRAY[
           '2026-11-21T02:59:59.999Z', '2026-11-21T03:00:00Z',
           '2026-11-22T02:59:59.999Z', '2026-11-22T02:59:59.999Z', '2026-11-22T03:00:00Z'
         ]) AS instant`,
        [product.id, a],
      );
      const rows = await inventory.listMovements({
        from: '2026-11-21',
        to: '2026-11-21',
        productId: product.id,
      });
      expect(rows).toHaveLength(3);
      expect(rows[0].id).toBeGreaterThan(rows[1].id);
      expect(rows[2].occurredAt).toBe('2026-11-21T03:00:00.000Z');
      expect(
        await inventory.listMovements({ from: '2026-11-22' }),
      ).toHaveLength(1);
      expect(await inventory.listMovements({ to: '2026-11-20' })).toHaveLength(
        1,
      );
    });

    it('protege la tabla con RLS, permisos y restricciones de signo y motivo', async () => {
      const {
        rows: [rls],
      } = await pool.query(
        "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.stock_movements'::regclass",
      );
      expect(rls.relrowsecurity).toBe(true);
      for (const role of ['anon', 'authenticated']) {
        const {
          rows: [privilege],
        } = await pool.query(
          "SELECT has_table_privilege($1, 'public.stock_movements', 'SELECT,INSERT,UPDATE,DELETE') AS allowed",
          [role],
        );
        expect(privilege.allowed).toBe(false);
      }
      const category = await products.createCategory({ name: 'Macetas' });
      const product = await products.createProduct(
        { name: 'Maceta', categoryId: category.id },
        a,
      );
      for (const [type, delta, reason] of [
        ['PRODUCCION', 0, null],
        ['PRODUCCION', -1, null],
        ['AJUSTE_NEGATIVO', 1, 'Conteo'],
        ['AJUSTE_POSITIVO', 1, null],
        ['AJUSTE_NEGATIVO', -1, ' '],
        ['VENTA', -1, 'Venta'],
      ]) {
        await expect(
          pool.query(
            'INSERT INTO public.stock_movements (product_id, movement_type, quantity_delta, reason, created_by) VALUES ($1, $2, $3, $4, $5)',
            [product.id, type, delta, reason, a],
          ),
        ).rejects.toMatchObject({ code: '23514' });
      }
      expect(await inventory.listMovements({})).toEqual([]);
    });

    async function stockedProduct(name = 'Maceta', stock = 10) {
      const category =
        (await products.listCategories())[0] ??
        (await products.createCategory({ name: 'Macetas' }));
      const product = await products.createProduct(
        { name, categoryId: category.id, manualCost: 500 },
        a,
      );
      await inventory.registerProduction(
        { productId: product.id, quantity: stock },
        a,
      );
      return product;
    }

    function saleItem(productId: number, quantity = 1) {
      return {
        productId,
        quantity,
        unitPrice: 0.3,
        unitCost: 0.1,
        costSource: 'MANUAL' as const,
      };
    }

    it('confirma ventas con centavos exactos, acumula duplicados y conserva el costo histórico', async () => {
      const product = await stockedProduct();
      const sale = await sales.create(
        {
          saleType: 'MINORISTA',
          items: [saleItem(product.id, 2), saleItem(product.id)],
        },
        a,
      );
      expect(sale).toMatchObject({
        status: 'CONFIRMADA',
        saleType: 'MINORISTA',
        totalAmount: 0.9,
        totalCost: 0.3,
        grossMargin: 0.6,
        units: 3,
        itemCount: 1,
        items: [
          expect.objectContaining({
            quantity: 3,
            costSource: 'MANUAL',
            unitCost: 0.1,
            costEstimateId: null,
          }),
        ],
      });
      expect((await products.getProduct(product.id)).stock).toBe(7);
      expect(await inventory.listMovements({ type: 'VENTA' })).toEqual([
        expect.objectContaining({
          saleId: sale.id,
          saleItemId: sale.items[0].id,
          returnId: null,
          quantityDelta: -3,
        }),
      ]);
      await products.updateProduct(product.id, { manualCost: 999 });
      expect((await sales.get(sale.id)).items[0].unitCost).toBe(0.1);
      expect(await sales.list({ saleType: 'MAYORISTA' })).toEqual([]);
      expect(
        await sales.list({ saleType: 'MINORISTA', status: 'CONFIRMADA' }),
      ).toHaveLength(1);
    });

    it('rechaza diferencias de precio o costo en duplicados, costos ausentes y totales fuera de rango', async () => {
      const product = await stockedProduct();
      for (const items of [
        [saleItem(product.id), { ...saleItem(product.id), unitCost: 0.2 }],
        [saleItem(product.id), { ...saleItem(product.id), unitPrice: 0.4 }],
        [
          {
            ...saleItem(product.id),
            quantity: 2_147_483_647,
            unitPrice: 9_999_999_999.99,
          },
        ],
      ]) {
        await expect(
          sales.create({ saleType: 'MINORISTA', items }, a),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(await sales.list({})).toEqual([]);
      expect((await products.getProduct(product.id)).stock).toBe(10);
    });

    it('revierte toda la venta si falta stock de un producto y detecta productos inactivos o inexistentes', async () => {
      const first = await stockedProduct('Primero', 5);
      const second = await stockedProduct('Segundo', 1);
      await expect(
        sales.create(
          {
            saleType: 'MAYORISTA',
            items: [saleItem(first.id), saleItem(second.id, 2)],
          },
          a,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await sales.list({})).toEqual([]);
      expect((await products.getProduct(first.id)).stock).toBe(5);
      expect(await inventory.listMovements({ type: 'VENTA' })).toEqual([]);
      await products.setProductStatus(second.id, false);
      await expect(
        sales.create(
          { saleType: 'MINORISTA', items: [saleItem(second.id)] },
          a,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        sales.create(
          { saleType: 'MINORISTA', items: [saleItem(Number.MAX_SAFE_INTEGER)] },
          a,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('revierte cabecera, detalles y movimientos ante un fallo posterior a la escritura', async () => {
      const product = await stockedProduct();
      // El trigger de prueba provoca un fallo cuando los detalles ya se insertaron.
      await pool.query(`CREATE FUNCTION public.fail_sale_movement() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.movement_type = 'VENTA' THEN RAISE EXCEPTION 'Fallo de prueba'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER fail_sale_movement BEFORE INSERT ON public.stock_movements
        FOR EACH ROW EXECUTE FUNCTION public.fail_sale_movement();`);
      try {
        await expect(
          sales.create(
            { saleType: 'MINORISTA', items: [saleItem(product.id)] },
            a,
          ),
        ).rejects.toMatchObject({ code: 'P0001' });
        expect(await sales.list({})).toEqual([]);
        expect((await products.getProduct(product.id)).stock).toBe(10);
        expect(
          (await pool.query('SELECT * FROM public.sale_items')).rows,
        ).toEqual([]);
      } finally {
        await pool.query(
          'DROP TRIGGER fail_sale_movement ON public.stock_movements; DROP FUNCTION public.fail_sale_movement()',
        );
      }
    });

    it('impide que ventas simultáneas consuman las mismas últimas unidades', async () => {
      const product = await stockedProduct('Última unidad', 1);
      const input = {
        saleType: 'MINORISTA' as const,
        items: [saleItem(product.id)],
      };
      const outcomes = await Promise.allSettled([
        sales.create(input, a),
        sales.create(input, b),
      ]);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(outcomes).toContainEqual(
        expect.objectContaining({
          status: 'rejected',
          reason: expect.any(ConflictException),
        }),
      );
      expect((await products.getProduct(product.id)).stock).toBe(0);
      expect(await sales.list({})).toHaveLength(1);
    });

    it('ordena los bloqueos en ventas simultáneas que seleccionan productos en orden inverso', async () => {
      const first = await stockedProduct('Primero', 2);
      const second = await stockedProduct('Segundo', 2);
      await Promise.all([
        sales.create(
          {
            saleType: 'MAYORISTA',
            items: [saleItem(first.id), saleItem(second.id)],
          },
          a,
        ),
        sales.create(
          {
            saleType: 'MINORISTA',
            items: [saleItem(second.id), saleItem(first.id)],
          },
          b,
        ),
      ]);
      expect((await products.getProduct(first.id)).stock).toBe(0);
      expect((await products.getProduct(second.id)).stock).toBe(0);
    });

    it('anula una sola vez y restituye productos desactivados conservando los importes', async () => {
      const product = await stockedProduct();
      const sale = await sales.create(
        { saleType: 'MAYORISTA', items: [saleItem(product.id, 3)] },
        a,
      );
      await products.setProductStatus(product.id, false);
      const cancelled = await sales.cancel(sale.id, 'Error de carga', b);
      expect(cancelled).toMatchObject({
        status: 'ANULADA',
        cancelledBy: b,
        cancellationReason: 'Error de carga',
        totalAmount: 0.9,
      });
      expect((await products.getProduct(product.id)).stock).toBe(10);
      await expect(
        sales.cancel(sale.id, 'Reintento', b),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        sales.createReturn(
          sale.id,
          {
            reason: 'Devolución',
            items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
          },
          b,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await inventory.listMovements({ type: 'ANULACION' })).toHaveLength(
        1,
      );
    });

    it('registra devoluciones parciales y totales, sin superar la venta ni permitir anularla', async () => {
      const product = await stockedProduct();
      const sale = await sales.create(
        { saleType: 'MINORISTA', items: [saleItem(product.id, 3)] },
        a,
      );
      const itemId = sale.items[0].id;
      const partial = await sales.createReturn(
        sale.id,
        {
          reason: 'Devolución parcial',
          items: [{ saleItemId: itemId, quantity: 1 }],
        },
        b,
      );
      expect(partial).toMatchObject({
        status: 'PARCIALMENTE_DEVUELTA',
        totalAmount: 0.9,
        items: [expect.objectContaining({ returnedQuantity: 1 })],
      });
      await expect(sales.cancel(sale.id, 'Error', b)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(
        sales.createReturn(
          sale.id,
          { reason: 'Exceso', items: [{ saleItemId: itemId, quantity: 3 }] },
          b,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        sales.createReturn(
          sale.id,
          {
            reason: 'Ajeno',
            items: [{ saleItemId: Number.MAX_SAFE_INTEGER, quantity: 1 }],
          },
          b,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      const complete = await sales.createReturn(
        sale.id,
        {
          reason: 'Resto',
          items: [
            { saleItemId: itemId, quantity: 1 },
            { saleItemId: itemId, quantity: 1 },
          ],
        },
        b,
      );
      expect(complete.status).toBe('DEVUELTA');
      expect(complete.items[0].returnedQuantity).toBe(3);
      expect(complete.returns).toHaveLength(2);
      expect((await products.getProduct(product.id)).stock).toBe(10);
      expect(await inventory.listMovements({ type: 'DEVOLUCION' })).toEqual([
        expect.objectContaining({
          returnId: complete.returns[1].id,
          saleId: sale.id,
        }),
        expect.objectContaining({
          returnId: complete.returns[0].id,
          saleId: sale.id,
        }),
      ]);
    });

    it('serializa devoluciones y anulaciones simultáneas sin duplicar restituciones', async () => {
      const product = await stockedProduct('Última unidad', 1);
      const sale = await sales.create(
        { saleType: 'MINORISTA', items: [saleItem(product.id)] },
        a,
      );
      const outcomes = await Promise.allSettled([
        sales.cancel(sale.id, 'Error', a),
        sales.createReturn(
          sale.id,
          {
            reason: 'Devuelto',
            items: [{ saleItemId: sale.items[0].id, quantity: 1 }],
          },
          b,
        ),
      ]);
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect((await products.getProduct(product.id)).stock).toBe(1);
    });

    it('filtra ventas por días completos y conserva permisos RLS en las tablas nuevas', async () => {
      const product = await stockedProduct();
      const first = await sales.create(
        { saleType: 'MINORISTA', items: [saleItem(product.id)] },
        a,
      );
      const second = await sales.create(
        { saleType: 'MAYORISTA', items: [saleItem(product.id)] },
        b,
      );
      await pool.query(
        "UPDATE public.sales SET sold_at = '2026-11-22T02:59:59.999Z' WHERE id = $1",
        [first.id],
      );
      await pool.query(
        "UPDATE public.sales SET sold_at = '2026-11-22T03:00:00Z' WHERE id = $1",
        [second.id],
      );
      expect(
        (await sales.list({ from: '2026-11-22', to: '2026-11-22' })).map(
          ({ id }) => id,
        ),
      ).toEqual([second.id]);
      for (const table of [
        'sales',
        'sale_items',
        'sale_returns',
        'sale_return_items',
      ]) {
        const {
          rows: [row],
        } = await pool.query(
          "SELECT relrowsecurity, has_table_privilege('authenticated', oid, 'SELECT,INSERT,UPDATE,DELETE') AS allowed FROM pg_class WHERE oid = $1::regclass",
          [`public.${table}`],
        );
        expect(row).toMatchObject({ relrowsecurity: true, allowed: false });
      }
    });

    afterAll(async () => {
      if (ownsSchema)
        await pool.query(
          'DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA auth CASCADE',
        );
      if (pool) await pool.end();
    });
  },
);
