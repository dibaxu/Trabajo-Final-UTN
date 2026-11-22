import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { TransactionClient } from '../../infrastructure/database/database.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import type {
  CreateCategoryDto,
  CreateProductDto,
  ProductCategoryDto,
  ProductDto,
  ProductFiltersDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './products.dto.js';

type CategoryRow = Omit<ProductCategoryDto, 'id'> & { id: string };
type ProductRow = Omit<
  ProductDto,
  | 'id'
  | 'categoryId'
  | 'referenceSalePrice'
  | 'manualCost'
  | 'imageUrl'
  | 'stock'
> & {
  id: string;
  categoryId: string;
  referenceSalePrice: string;
  manualCost: string | null;
};

const productQuery = `SELECT p.id, p.name, p.category_id AS "categoryId",
  c.name AS "categoryName", p.sku, p.description,
  p.reference_sale_price AS "referenceSalePrice", p.manual_cost AS "manualCost",
  p.is_active AS "isActive"
  FROM public.products p JOIN public.product_categories c ON c.id = p.category_id`;

function catalogId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new RangeError('Identificador de catálogo fuera del rango seguro.');
  }
  return id;
}

function productView(row: ProductRow, stock: number): ProductDto {
  return {
    ...row,
    id: catalogId(row.id),
    categoryId: catalogId(row.categoryId),
    referenceSalePrice: Number(row.referenceSalePrice),
    manualCost: row.manualCost === null ? null : Number(row.manualCost),
    imageUrl: null,
    stock,
  };
}

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  async listCategories(): Promise<ProductCategoryDto[]> {
    const { rows } = await this.db.query<CategoryRow>(`
      SELECT id, name, is_active AS "isActive" FROM public.product_categories
      ORDER BY lower(name), id`);
    return rows.map((row) => ({ ...row, id: catalogId(row.id) }));
  }

  createCategory(input: CreateCategoryDto): Promise<ProductCategoryDto> {
    return this.saveCategory(
      `INSERT INTO public.product_categories (name) VALUES ($1)
       RETURNING id, name, is_active AS "isActive"`,
      [input.name],
    );
  }

  updateCategory(
    id: number,
    input: UpdateCategoryDto,
  ): Promise<ProductCategoryDto> {
    if (input.name === undefined && input.isActive === undefined) {
      throw new BadRequestException(
        'Indicá al menos un campo para actualizar.',
      );
    }
    return this.saveCategory(
      `UPDATE public.product_categories
       SET name = COALESCE($2, name), is_active = COALESCE($3, is_active), updated_at = now()
       WHERE id = $1 RETURNING id, name, is_active AS "isActive"`,
      [id, input.name, input.isActive],
    );
  }

  async listProducts(filters: ProductFiltersDto): Promise<ProductDto[]> {
    const { rows } = await this.db.query<ProductRow>(
      `${productQuery}
       WHERE ($1::text IS NULL OR strpos(lower(p.name), lower($1)) > 0
          OR strpos(lower(p.sku), lower($1)) > 0)
         AND ($2::bigint IS NULL OR p.category_id = $2)
         AND ($3::boolean IS NULL OR p.is_active = $3)
       ORDER BY lower(p.name), p.id`,
      [
        filters.search || null,
        filters.categoryId,
        filters.status && filters.status === 'active',
      ],
    );
    return this.productViews(rows);
  }

  async getProduct(id: number): Promise<ProductDto> {
    const row = await this.findProduct(this.db, id);
    return (await this.productViews([row]))[0];
  }

  createProduct(input: CreateProductDto, actorId: string): Promise<ProductDto> {
    return this.writeProduct(async (client) => {
      await this.requireActiveCategory(client, input.categoryId);
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO public.products
           (name, category_id, sku, description, reference_sale_price, manual_cost, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          input.name,
          input.categoryId,
          input.sku || null,
          input.description || null,
          input.referenceSalePrice ?? 0,
          input.manualCost,
          input.isActive ?? true,
          actorId,
        ],
      );
      const row = await this.findProduct(client, rows[0].id);
      return (await this.productViews([row], client))[0];
    });
  }

  updateProduct(id: number, input: UpdateProductDto): Promise<ProductDto> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException(
        'Indicá al menos un campo para actualizar.',
      );
    }
    return this.writeProduct(async (client) => {
      const current = await this.findProduct(client, id, true);
      if (
        input.categoryId !== undefined &&
        String(input.categoryId) !== current.categoryId
      ) {
        await this.requireActiveCategory(client, input.categoryId);
      }
      await client.query(
        `UPDATE public.products SET name = $2, category_id = $3, sku = $4,
           description = $5, reference_sale_price = $6, manual_cost = $7, updated_at = now()
         WHERE id = $1`,
        [
          id,
          input.name ?? current.name,
          input.categoryId ?? current.categoryId,
          input.sku === undefined ? current.sku : input.sku || null,
          input.description === undefined
            ? current.description
            : input.description || null,
          input.referenceSalePrice ?? current.referenceSalePrice,
          input.manualCost === undefined
            ? current.manualCost
            : input.manualCost,
        ],
      );
      const row = await this.findProduct(client, id);
      return (await this.productViews([row], client))[0];
    });
  }

  setProductStatus(id: number, isActive: boolean): Promise<ProductDto> {
    return this.db.transaction(async (client) => {
      const result = await client.query(
        'UPDATE public.products SET is_active = $2, updated_at = now() WHERE id = $1',
        [id, isActive],
      );
      if (!result.rowCount)
        throw new NotFoundException('Producto no encontrado.');
      const row = await this.findProduct(client, id);
      return (await this.productViews([row], client))[0];
    });
  }

  private async productViews(
    rows: ProductRow[],
    client: Pick<DatabaseService, 'query'> = this.db,
  ): Promise<ProductDto[]> {
    const balances = await this.inventory.getBalances(
      rows.map((row) => catalogId(row.id)),
      client,
    );
    return rows.map((row) =>
      productView(row, balances.get(catalogId(row.id))!),
    );
  }

  private async saveCategory(
    sql: string,
    params: unknown[],
  ): Promise<ProductCategoryDto> {
    try {
      const {
        rows: [row],
      } = await this.db.query<CategoryRow>(sql, params);
      if (!row) throw new NotFoundException('Categoría no encontrada.');
      return { ...row, id: catalogId(row.id) };
    } catch (error) {
      if (
        error instanceof DatabaseError &&
        error.constraint === 'product_categories_name_normalized_unique'
      ) {
        throw new ConflictException('Ya existe una categoría con ese nombre.');
      }
      throw error;
    }
  }

  private async writeProduct(
    work: (client: TransactionClient) => Promise<ProductDto>,
  ): Promise<ProductDto> {
    try {
      return await this.db.transaction(work);
    } catch (error) {
      if (
        error instanceof DatabaseError &&
        error.constraint === 'products_sku_normalized_unique'
      ) {
        throw new ConflictException(
          'Ya existe un producto con ese código interno.',
        );
      }
      throw error;
    }
  }

  private async findProduct(
    client: Pick<DatabaseService, 'query'>,
    id: number | string,
    lock = false,
  ): Promise<ProductRow> {
    const {
      rows: [row],
    } = await client.query<ProductRow>(
      `${productQuery} WHERE p.id = $1${lock ? ' FOR UPDATE OF p' : ''}`,
      [id],
    );
    if (!row) throw new NotFoundException('Producto no encontrado.');
    return row;
  }

  private async requireActiveCategory(
    client: TransactionClient,
    id: number,
  ): Promise<void> {
    // Mantiene la categoría activa hasta confirmar la asignación.
    const {
      rows: [row],
    } = await client.query<{ is_active: boolean }>(
      'SELECT is_active FROM public.product_categories WHERE id = $1 FOR SHARE',
      [id],
    );
    if (!row)
      throw new BadRequestException('La categoría seleccionada no existe.');
    if (!row.is_active)
      throw new BadRequestException('La categoría seleccionada está inactiva.');
  }
}
