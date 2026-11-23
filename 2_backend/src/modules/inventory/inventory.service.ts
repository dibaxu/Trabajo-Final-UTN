import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { TransactionClient } from '../../infrastructure/database/database.service.js';
import type {
  AdjustStockDto,
  MovementFiltersDto,
  MovementType,
  RegisterProductionDto,
  StockChangeDto,
  StockDto,
  StockFiltersDto,
  StockMovementDto,
} from './inventory.dto.js';

type QueryClient = Pick<DatabaseService, 'query'>;
type MovementRow = Omit<
  StockMovementDto,
  'id' | 'productId' | 'occurredAt' | 'saleId' | 'saleItemId' | 'returnId'
> & {
  id: string;
  productId: string;
  occurredAt: Date;
  saleId: string | null;
  saleItemId: string | null;
  returnId: string | null;
};
export interface SaleStockQuantity {
  productId: number;
  quantity: number;
}
export interface SaleStockRestoration extends SaleStockQuantity {
  saleItemId: number;
  saleReturnItemId?: number;
}
type StockRow = Omit<StockDto, 'id' | 'categoryId' | 'stock'> & {
  id: string;
  categoryId: string;
  stock: string;
};

const movementQuery = `SELECT m.id, m.product_id AS "productId", p.name AS "productName",
  m.movement_type AS type, m.quantity_delta AS "quantityDelta", m.reason,
  m.occurred_at AS "occurredAt", m.created_by AS "createdBy", actor.display_name AS "createdByName",
  si.sale_id AS "saleId", m.sale_item_id AS "saleItemId", ri.sale_return_id AS "returnId"
  FROM public.stock_movements m JOIN public.products p ON p.id = m.product_id
  JOIN public.profiles actor ON actor.id = m.created_by
  LEFT JOIN public.sale_items si ON si.id = m.sale_item_id
  LEFT JOIN public.sale_return_items ri ON ri.id = m.sale_return_item_id`;

function safeNumber(value: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new RangeError('Valor de inventario fuera del rango seguro.');
  }
  return number;
}

function movementView(row: MovementRow): StockMovementDto {
  return {
    ...row,
    id: safeNumber(row.id),
    productId: safeNumber(row.productId),
    saleId: row.saleId === null ? null : safeNumber(row.saleId),
    saleItemId: row.saleItemId === null ? null : safeNumber(row.saleItemId),
    returnId: row.returnId === null ? null : safeNumber(row.returnId),
    occurredAt: row.occurredAt.toISOString(),
  };
}

@Injectable()
export class InventoryService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  /** Bloquea y valida el stock antes de crear los detalles y sus referencias FK. */
  async fulfillSale(
    client: TransactionClient,
    quantities: readonly SaleStockQuantity[],
    actorId: string,
    saveItems: () => Promise<ReadonlyMap<number, number>>,
  ): Promise<void> {
    const ids = quantities.map(({ productId }) => productId);
    await this.lockSaleProducts(client, ids, true);
    const balances = await this.getBalances(ids, client);
    for (const item of quantities) {
      if (item.quantity > balances.get(item.productId)!) {
        throw new ConflictException(
          `Stock insuficiente del producto ${item.productId}.`,
        );
      }
    }
    const references = await saveItems();
    for (const item of quantities) {
      const saleItemId = references.get(item.productId);
      if (saleItemId === undefined)
        throw new Error('Falta el detalle de venta para registrar su salida.');
      await client.query(
        `INSERT INTO public.stock_movements (product_id, sale_item_id, movement_type, quantity_delta, created_by)
         VALUES ($1, $2, 'VENTA', $3, $4)`,
        [item.productId, saleItemId, -item.quantity, actorId],
      );
    }
  }

  /** Restituye unidades históricas incluso si el producto fue desactivado. */
  async restoreSale(
    client: TransactionClient,
    items: readonly SaleStockRestoration[],
    type: 'ANULACION' | 'DEVOLUCION',
    reason: string,
    actorId: string,
  ): Promise<void> {
    const ids = items.map(({ productId }) => productId);
    await this.lockSaleProducts(client, ids, false);
    const balances = await this.getBalances(ids, client);
    for (const item of items) {
      const after = balances.get(item.productId)! + item.quantity;
      if (!Number.isSafeInteger(after))
        throw new ConflictException(
          'El stock resultante supera el rango permitido.',
        );
      balances.set(item.productId, after);
      await client.query(
        `INSERT INTO public.stock_movements
           (product_id, sale_item_id, sale_return_item_id, movement_type, quantity_delta, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item.productId,
          item.saleItemId,
          item.saleReturnItemId,
          type,
          item.quantity,
          reason,
          actorId,
        ],
      );
    }
  }

  private async lockSaleProducts(
    client: TransactionClient,
    productIds: readonly number[],
    requireActive: boolean,
  ): Promise<void> {
    // Un orden común evita interbloqueos entre ventas con varios productos.
    const { rows } = await client.query<{ id: string; is_active: boolean }>(
      'SELECT id, is_active FROM public.products WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE',
      [productIds],
    );
    if (rows.length !== new Set(productIds).size)
      throw new NotFoundException('Producto no encontrado.');
    if (requireActive && rows.some((row) => !row.is_active)) {
      throw new BadRequestException('La venta contiene un producto inactivo.');
    }
  }

  /** Comparte existencias con otros módulos sin exponer el registro de movimientos. */
  async getBalances(
    productIds: readonly number[],
    client: QueryClient = this.db,
  ): Promise<Map<number, number>> {
    const balances = new Map(productIds.map((id) => [id, 0]));
    if (!productIds.length) return balances;
    const { rows } = await client.query<{ product_id: string; stock: string }>(
      `SELECT product_id, SUM(quantity_delta) AS stock FROM public.stock_movements
       WHERE product_id = ANY($1::bigint[]) GROUP BY product_id`,
      [productIds],
    );
    for (const row of rows)
      balances.set(safeNumber(row.product_id), safeNumber(row.stock));
    return balances;
  }

  async listStock(filters: StockFiltersDto): Promise<StockDto[]> {
    const { rows } = await this.db.query<StockRow>(
      `SELECT p.id, p.name, p.sku, p.category_id AS "categoryId", c.name AS "categoryName",
         COALESCE(SUM(m.quantity_delta), 0) AS stock
       FROM public.products p JOIN public.product_categories c ON c.id = p.category_id
       LEFT JOIN public.stock_movements m ON m.product_id = p.id
       WHERE p.is_active
         AND ($1::text IS NULL OR strpos(lower(p.name), lower($1)) > 0
              OR strpos(lower(p.sku), lower($1)) > 0)
         AND ($2::bigint IS NULL OR p.category_id = $2)
       GROUP BY p.id, c.id
       HAVING ($3::text IS NULL
           OR ($3 = 'available' AND COALESCE(SUM(m.quantity_delta), 0) > 0)
           OR ($3 = 'out' AND COALESCE(SUM(m.quantity_delta), 0) = 0))
       ORDER BY lower(p.name), p.id`,
      [filters.search || null, filters.categoryId, filters.availability],
    );
    return rows.map((row) => ({
      ...row,
      id: safeNumber(row.id),
      categoryId: safeNumber(row.categoryId),
      stock: safeNumber(row.stock),
    }));
  }

  async listMovements(
    filters: MovementFiltersDto,
  ): Promise<StockMovementDto[]> {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new BadRequestException(
        'La fecha inicial debe ser anterior o igual a la final.',
      );
    }
    const { rows } = await this.db.query<MovementRow>(
      `${movementQuery}
       WHERE ($1::bigint IS NULL OR m.product_id = $1)
         AND ($2::text IS NULL OR m.movement_type = $2)
         AND ($3::date IS NULL OR m.occurred_at >=
              ($3::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'))
         AND ($4::date IS NULL OR m.occurred_at <
              (($4::date + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'))
       ORDER BY m.occurred_at DESC, m.id DESC`,
      [filters.productId, filters.type, filters.from, filters.to],
    );
    return rows.map(movementView);
  }

  registerProduction(
    input: RegisterProductionDto,
    actorId: string,
  ): Promise<StockChangeDto> {
    return this.recordMovement(
      input.productId,
      input.quantity,
      'PRODUCCION',
      input.note?.trim() || null,
      actorId,
    );
  }

  adjustStock(input: AdjustStockDto, actorId: string): Promise<StockChangeDto> {
    if (!['INCREASE', 'DECREASE'].includes(input.direction)) {
      throw new BadRequestException(
        'Indicá si el ajuste aumenta o reduce el stock.',
      );
    }
    const increase = input.direction === 'INCREASE';
    return this.recordMovement(
      input.productId,
      increase ? input.quantity : -input.quantity,
      increase ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO',
      input.reason.trim(),
      actorId,
    );
  }

  private recordMovement(
    productId: number,
    delta: number,
    type: MovementType,
    reason: string | null,
    actorId: string,
  ): Promise<StockChangeDto> {
    const correctSign = type === 'AJUSTE_NEGATIVO' ? delta < 0 : delta > 0;
    if (
      !Number.isInteger(delta) ||
      !correctSign ||
      Math.abs(delta) > 2_147_483_647
    ) {
      throw new BadRequestException(
        'La cantidad debe ser un entero positivo dentro del rango permitido.',
      );
    }
    if (type !== 'PRODUCCION' && !reason) {
      throw new BadRequestException('El motivo del ajuste es obligatorio.');
    }
    return this.db.transaction(async (client) => {
      // El bloqueo precede a la lectura del saldo y coordina también la desactivación del producto.
      const {
        rows: [product],
      } = await client.query<{ is_active: boolean }>(
        'SELECT is_active FROM public.products WHERE id = $1 FOR UPDATE',
        [productId],
      );
      if (!product) throw new NotFoundException('Producto no encontrado.');
      if (!product.is_active)
        throw new BadRequestException('El producto está inactivo.');
      const balances = await this.getBalances([productId], client);
      const stockBefore = balances.get(productId)!;
      const stockAfter = stockBefore + delta;
      if (stockAfter < 0)
        throw new ConflictException(
          `Stock insuficiente. Existencias actuales: ${stockBefore}.`,
        );
      if (!Number.isSafeInteger(stockAfter)) {
        throw new ConflictException(
          'El stock resultante supera el rango permitido.',
        );
      }
      const {
        rows: [inserted],
      } = await client.query<{ id: string }>(
        `INSERT INTO public.stock_movements (product_id, movement_type, quantity_delta, reason, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [productId, type, delta, reason, actorId],
      );
      const {
        rows: [movement],
      } = await client.query<MovementRow>(`${movementQuery} WHERE m.id = $1`, [
        inserted.id,
      ]);
      return { movement: movementView(movement), stockBefore, stockAfter };
    });
  }
}
