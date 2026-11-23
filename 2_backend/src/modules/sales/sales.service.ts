import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { TransactionClient } from '../../infrastructure/database/database.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import type { SaleStockRestoration } from '../inventory/inventory.service.js';
import type {
  CreateReturnDto,
  CreateSaleDto,
  CreateSaleItemDto,
  SaleDto,
  SaleItemDto,
  SaleReturnDto,
  SaleReturnItemDto,
  SalesFiltersDto,
} from './sales.dto.js';

type SaleRow = Omit<
  SaleDto,
  | 'id'
  | 'soldAt'
  | 'createdAt'
  | 'cancelledAt'
  | 'totalAmount'
  | 'totalCost'
  | 'grossMargin'
  | 'items'
  | 'returns'
  | 'units'
  | 'itemCount'
> & {
  id: string;
  soldAt: Date;
  createdAt: Date;
  cancelledAt: Date | null;
  totalAmount: string;
  totalCost: string;
  grossMargin: string;
};
type ItemRow = Omit<
  SaleItemDto,
  | 'id'
  | 'productId'
  | 'costEstimateId'
  | 'unitPrice'
  | 'unitCost'
  | 'lineTotal'
  | 'lineCost'
  | 'lineMargin'
  | 'returnedQuantity'
> & {
  id: string;
  saleId: string;
  productId: string;
  unitPrice: string;
  unitCost: string;
  lineTotal: string;
  lineCost: string;
  lineMargin: string;
  returnedQuantity: string;
};
type ReturnRow = Omit<
  SaleReturnDto,
  'id' | 'saleId' | 'returnedAt' | 'items'
> & {
  id: string;
  saleId: string;
  returnedAt: Date;
};
type ReturnItemRow = Omit<SaleReturnItemDto, 'id' | 'saleItemId'> & {
  id: string;
  saleItemId: string;
  returnId: string;
};

const saleQuery = `SELECT s.id, s.status, s.sale_type AS "saleType", s.sold_at AS "soldAt",
  s.total_amount AS "totalAmount", s.total_cost AS "totalCost", s.gross_margin AS "grossMargin",
  s.notes, s.created_by AS "createdBy", actor.display_name AS "createdByName",
  s.created_at AS "createdAt", s.cancellation_reason AS "cancellationReason",
  s.cancelled_by AS "cancelledBy", canceller.display_name AS "cancelledByName", s.cancelled_at AS "cancelledAt"
  FROM public.sales s JOIN public.profiles actor ON actor.id = s.created_by
  LEFT JOIN public.profiles canceller ON canceller.id = s.cancelled_by`;

function safeInteger(value: string | number): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0)
    throw new RangeError('Identificador o cantidad fuera del rango seguro.');
  return result;
}

function cents(value: number): bigint {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 9_999_999_999.99 ||
    Number(value.toFixed(2)) !== value
  ) {
    throw new BadRequestException(
      'Los importes deben ser no negativos y tener hasta dos decimales.',
    );
  }
  return BigInt(value.toFixed(2).replace('.', ''));
}

function decimal(value: bigint): string {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < -BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new BadRequestException(
      'Los totales superan el rango monetario permitido.',
    );
  }
  const absolute = value < 0 ? -value : value;
  return `${value < 0 ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

function quantity(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new BadRequestException(
      'La cantidad debe ser un entero entre 1 y 2147483647.',
    );
  }
  return value;
}

function mergeItems(input: readonly CreateSaleItemDto[]): CreateSaleItemDto[] {
  if (!input.length)
    throw new BadRequestException(
      'La venta debe incluir al menos un producto.',
    );
  const merged = new Map<number, CreateSaleItemDto>();
  for (const item of input) {
    quantity(item.quantity);
    if (item.costSource !== 'MANUAL')
      throw new BadRequestException('Indicá un costo manual por detalle.');
    cents(item.unitCost);
    cents(item.unitPrice);
    const previous = merged.get(item.productId);
    if (
      previous &&
      (previous.unitPrice !== item.unitPrice ||
        previous.unitCost !== item.unitCost)
    ) {
      throw new BadRequestException(
        'Los detalles de un mismo producto deben tener el mismo precio y costo.',
      );
    }
    merged.set(item.productId, {
      productId: item.productId,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      costSource: item.costSource,
      quantity: quantity((previous?.quantity ?? 0) + item.quantity),
    });
  }
  return [...merged.values()];
}

@Injectable()
export class SalesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  async create(input: CreateSaleDto, actorId: string): Promise<SaleDto> {
    const items = mergeItems(input.items);
    const amount = items.reduce(
      (total, item) => total + cents(item.unitPrice) * BigInt(item.quantity),
      0n,
    );
    const cost = items.reduce(
      (total, item) => total + cents(item.unitCost) * BigInt(item.quantity),
      0n,
    );
    const totalAmount = decimal(amount);
    const totalCost = decimal(cost);
    return this.db.transaction(async (client) => {
      const {
        rows: [sale],
      } = await client.query<{ id: string }>(
        `INSERT INTO public.sales (sale_type, total_amount, total_cost, notes, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          input.saleType,
          totalAmount,
          totalCost,
          input.notes?.trim() || null,
          actorId,
        ],
      );
      await this.inventory.fulfillSale(client, items, actorId, async () => {
        const references = new Map<number, number>();
        for (const item of items) {
          const {
            rows: [inserted],
          } = await client.query<{ id: string }>(
            `INSERT INTO public.sale_items (sale_id, product_id, cost_source, quantity, unit_price, unit_cost)
             VALUES ($1, $2, 'MANUAL', $3, $4, $5) RETURNING id`,
            [
              sale.id,
              item.productId,
              item.quantity,
              decimal(cents(item.unitPrice)),
              decimal(cents(item.unitCost)),
            ],
          );
          references.set(item.productId, safeInteger(inserted.id));
        }
        return references;
      });
      return this.findSale(client, safeInteger(sale.id));
    });
  }

  list(filters: SalesFiltersDto): Promise<SaleDto[]> {
    this.validateRange(filters);
    return this.db.transaction(async (client) => {
      await client.query(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      return this.loadSales(client, filters);
    });
  }

  get(id: number): Promise<SaleDto> {
    return this.db.transaction(async (client) => {
      await client.query(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      return this.findSale(client, id);
    });
  }

  cancel(id: number, reason: string, actorId: string): Promise<SaleDto> {
    return this.db.transaction(async (client) => {
      await this.lockSale(client, id);
      const sale = await this.findSale(client, id);
      if (sale.status !== 'CONFIRMADA' || sale.returns.length) {
        throw new ConflictException(
          'Solo se puede anular una venta confirmada sin devoluciones.',
        );
      }
      await this.inventory.restoreSale(
        client,
        sale.items.map((item) => ({
          productId: item.productId,
          saleItemId: item.id,
          quantity: item.quantity,
        })),
        'ANULACION',
        reason,
        actorId,
      );
      await client.query(
        `UPDATE public.sales SET status = 'ANULADA', cancellation_reason = $2,
         cancelled_by = $3, cancelled_at = clock_timestamp() WHERE id = $1`,
        [id, reason, actorId],
      );
      return this.findSale(client, id);
    });
  }

  createReturn(
    id: number,
    input: CreateReturnDto,
    actorId: string,
  ): Promise<SaleDto> {
    return this.db.transaction(async (client) => {
      await this.lockSale(client, id);
      const sale = await this.findSale(client, id);
      if (sale.status === 'ANULADA' || sale.status === 'DEVUELTA') {
        throw new ConflictException(
          'La venta está anulada o ya fue devuelta completamente.',
        );
      }
      if (!input.items.length)
        throw new BadRequestException(
          'La devolución debe incluir al menos un detalle.',
        );
      const wanted = new Map<number, number>();
      for (const item of input.items) {
        wanted.set(
          item.saleItemId,
          quantity(
            (wanted.get(item.saleItemId) ?? 0) + quantity(item.quantity),
          ),
        );
      }
      for (const [itemId, count] of wanted) {
        const item = sale.items.find((row) => row.id === itemId);
        if (!item)
          throw new BadRequestException(
            'El detalle no pertenece a esta venta.',
          );
        if (count > item.quantity - item.returnedQuantity) {
          throw new ConflictException(
            'La devolución supera las unidades pendientes de devolver.',
          );
        }
      }
      const {
        rows: [returned],
      } = await client.query<{ id: string }>(
        'INSERT INTO public.sale_returns (sale_id, reason, created_by) VALUES ($1, $2, $3) RETURNING id',
        [id, input.reason, actorId],
      );
      const restored: SaleStockRestoration[] = [];
      for (const [itemId, count] of wanted) {
        const item = sale.items.find((row) => row.id === itemId)!;
        const {
          rows: [row],
        } = await client.query<{ id: string }>(
          'INSERT INTO public.sale_return_items (sale_return_id, sale_item_id, quantity) VALUES ($1, $2, $3) RETURNING id',
          [returned.id, itemId, count],
        );
        restored.push({
          productId: item.productId,
          saleItemId: itemId,
          saleReturnItemId: safeInteger(row.id),
          quantity: count,
        });
      }
      await this.inventory.restoreSale(
        client,
        restored,
        'DEVOLUCION',
        input.reason,
        actorId,
      );
      const complete = sale.items.every(
        (item) =>
          item.returnedQuantity + (wanted.get(item.id) ?? 0) === item.quantity,
      );
      await client.query('UPDATE public.sales SET status = $2 WHERE id = $1', [
        id,
        complete ? 'DEVUELTA' : 'PARCIALMENTE_DEVUELTA',
      ]);
      return this.findSale(client, id);
    });
  }

  private validateRange(filters: SalesFiltersDto): void {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new BadRequestException(
        'La fecha inicial debe ser anterior o igual a la final.',
      );
    }
  }

  private async lockSale(client: TransactionClient, id: number): Promise<void> {
    const { rows } = await client.query(
      'SELECT id FROM public.sales WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!rows.length) throw new NotFoundException('Venta no encontrada.');
  }

  private async findSale(
    client: TransactionClient,
    id: number,
  ): Promise<SaleDto> {
    const [sale] = await this.loadSales(client, {}, id);
    if (!sale) throw new NotFoundException('Venta no encontrada.');
    return sale;
  }

  private async loadSales(
    client: TransactionClient,
    filters: SalesFiltersDto,
    id?: number,
  ): Promise<SaleDto[]> {
    const { rows: sales } = await client.query<SaleRow>(
      `${saleQuery}
       WHERE ($1::date IS NULL OR s.sold_at >= ($1::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'))
         AND ($2::date IS NULL OR s.sold_at < (($2::date + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'))
         AND ($3::text IS NULL OR s.status = $3) AND ($4::text IS NULL OR s.sale_type = $4)
         AND ($5::bigint IS NULL OR s.id = $5) ORDER BY s.sold_at DESC, s.id DESC`,
      [filters.from, filters.to, filters.status, filters.saleType, id],
    );
    if (!sales.length) return [];
    const ids = sales.map((sale) => sale.id);
    const { rows: items } = await client.query<ItemRow>(
      `SELECT i.id, i.sale_id AS "saleId", i.product_id AS "productId", p.name AS "productName",
         i.cost_source AS "costSource", i.quantity, i.unit_price AS "unitPrice", i.unit_cost AS "unitCost",
         i.line_total AS "lineTotal", i.line_cost AS "lineCost", i.line_margin AS "lineMargin",
         COALESCE((SELECT SUM(ri.quantity) FROM public.sale_return_items ri WHERE ri.sale_item_id = i.id), 0) AS "returnedQuantity"
       FROM public.sale_items i JOIN public.products p ON p.id = i.product_id
       WHERE i.sale_id = ANY($1::bigint[]) ORDER BY i.id`,
      [ids],
    );
    const { rows: returns } = await client.query<ReturnRow>(
      `SELECT r.id, r.sale_id AS "saleId", r.returned_at AS "returnedAt", r.reason,
         r.created_by AS "createdBy", p.display_name AS "createdByName"
       FROM public.sale_returns r JOIN public.profiles p ON p.id = r.created_by
       WHERE r.sale_id = ANY($1::bigint[]) ORDER BY r.returned_at, r.id`,
      [ids],
    );
    const { rows: returnItems } = await client.query<ReturnItemRow>(
      `SELECT ri.id, ri.sale_return_id AS "returnId", ri.sale_item_id AS "saleItemId", ri.quantity
       FROM public.sale_return_items ri JOIN public.sale_returns r ON r.id = ri.sale_return_id
       WHERE r.sale_id = ANY($1::bigint[]) ORDER BY ri.id`,
      [ids],
    );
    const itemsBySale = new Map<string, SaleItemDto[]>();
    for (const row of items) {
      const mapped: SaleItemDto = {
        id: safeInteger(row.id),
        productId: safeInteger(row.productId),
        productName: row.productName,
        quantity: row.quantity,
        costSource: row.costSource,
        costEstimateId: null,
        unitPrice: Number(row.unitPrice),
        unitCost: Number(row.unitCost),
        lineTotal: Number(row.lineTotal),
        lineCost: Number(row.lineCost),
        lineMargin: Number(row.lineMargin),
        returnedQuantity: safeInteger(row.returnedQuantity),
      };
      const group = itemsBySale.get(row.saleId) ?? [];
      group.push(mapped);
      itemsBySale.set(row.saleId, group);
    }
    const returnItemsByReturn = new Map<string, SaleReturnItemDto[]>();
    for (const row of returnItems) {
      const group = returnItemsByReturn.get(row.returnId) ?? [];
      group.push({
        id: safeInteger(row.id),
        saleItemId: safeInteger(row.saleItemId),
        quantity: row.quantity,
      });
      returnItemsByReturn.set(row.returnId, group);
    }
    const returnsBySale = new Map<string, SaleReturnDto[]>();
    for (const row of returns) {
      const group = returnsBySale.get(row.saleId) ?? [];
      group.push({
        ...row,
        id: safeInteger(row.id),
        saleId: safeInteger(row.saleId),
        returnedAt: row.returnedAt.toISOString(),
        items: returnItemsByReturn.get(row.id) ?? [],
      });
      returnsBySale.set(row.saleId, group);
    }
    return sales.map((row) => {
      const details = itemsBySale.get(row.id) ?? [];
      return {
        ...row,
        id: safeInteger(row.id),
        soldAt: row.soldAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        cancelledAt: row.cancelledAt?.toISOString() ?? null,
        totalAmount: Number(row.totalAmount),
        totalCost: Number(row.totalCost),
        grossMargin: Number(row.grossMargin),
        items: details,
        returns: returnsBySale.get(row.id) ?? [],
        itemCount: details.length,
        units: safeInteger(
          details.reduce((total, item) => total + item.quantity, 0),
        ),
      };
    });
  }
}
