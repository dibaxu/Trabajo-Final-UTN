import { readFile } from 'node:fs/promises';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from '../dist/infrastructure/database/database.service.js';
import { AuthRepository } from '../dist/modules/auth/auth.repository.js';
import { ProductsService } from '../dist/modules/products/products.service.js';

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const pending = '33333333-3333-4333-8333-333333333333';
const sid = '44444444-4444-4444-8444-444444444444';

describe.skipIf(!databaseUrl)(
  'Acceso y catálogo en PostgreSQL real aislado',
  () => {
    let pool: Pool;
    let repository: AuthRepository;
    let products: ProductsService;
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
      products = new ProductsService(database);
    });

    beforeEach(async () => {
      await pool.query(
        'TRUNCATE public.products, public.product_categories, public.profiles, auth.sessions, auth.users CASCADE',
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
        stock: null,
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

    afterAll(async () => {
      if (ownsSchema)
        await pool.query(
          'DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA auth CASCADE',
        );
      if (pool) await pool.end();
    });
  },
);
