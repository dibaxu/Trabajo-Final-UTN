import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const movementTypes = [
  'PRODUCCION',
  'AJUSTE_POSITIVO',
  'AJUSTE_NEGATIVO',
] as const;
export type MovementType = (typeof movementTypes)[number];
const idSchema = {
  type: 'integer',
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
  example: 1,
} as const;
const maxQuantity = 2_147_483_647;
// eslint-disable-next-line no-control-regex -- PostgreSQL no admite NUL en valores text.
const postgresText = /^[^\u0000]*$/;
const datePattern = /^(?!0000)\d{4}-\d{2}-\d{2}$/;

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function queryId(value: unknown): unknown {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class StockFiltersDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Búsqueda por nombre o SKU, sin distinguir mayúsculas.',
  })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString()
  @Matches(postgresText)
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional(idSchema)
  @Transform(({ value }: { value: unknown }) => queryId(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  categoryId?: number;

  @ApiPropertyOptional({
    enum: ['available', 'out'],
    description: 'available incluye stock positivo; out incluye stock cero.',
  })
  @IsOptional()
  @IsIn(['available', 'out'])
  availability?: 'available' | 'out';
}

export class MovementFiltersDto {
  @ApiPropertyOptional(idSchema)
  @Transform(({ value }: { value: unknown }) => queryId(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  productId?: number;

  @ApiPropertyOptional({ enum: movementTypes })
  @IsOptional()
  @IsIn(movementTypes)
  type?: MovementType;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2026-11-01',
    description: 'Primer día incluido, en America/Argentina/Buenos_Aires.',
  })
  @IsOptional()
  @Matches(datePattern)
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2026-11-30',
    description: 'Último día incluido, en America/Argentina/Buenos_Aires.',
  })
  @IsOptional()
  @Matches(datePattern)
  @IsDateString({ strict: true })
  to?: string;
}

export class RegisterProductionDto {
  @ApiProperty(idSchema)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  productId: number;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: maxQuantity,
    example: 10,
  })
  @IsInt()
  @Min(1)
  @Max(maxQuantity)
  quantity: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    example: 'Lote de impresión terminado.',
  })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString()
  @Matches(postgresText)
  @MaxLength(200)
  note?: string | null;
}

export class AdjustStockDto {
  @ApiProperty(idSchema)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  productId: number;

  @ApiProperty({ enum: ['INCREASE', 'DECREASE'], example: 'DECREASE' })
  @IsIn(['INCREASE', 'DECREASE'])
  direction: 'INCREASE' | 'DECREASE';

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: maxQuantity,
    example: 2,
  })
  @IsInt()
  @Min(1)
  @Max(maxQuantity)
  quantity: number;

  @ApiProperty({ minLength: 1, maxLength: 200, example: 'Piezas dañadas.' })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @IsNotEmpty()
  @Matches(postgresText)
  @MaxLength(200)
  reason: string;
}

export class StockDto {
  @ApiProperty(idSchema)
  id: number;

  @ApiProperty({ example: 'Maceta geométrica' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'MAC-01' })
  sku: string | null;

  @ApiProperty(idSchema)
  categoryId: number;

  @ApiProperty({ example: 'Macetas' })
  categoryName: string;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    example: 10,
  })
  stock: number;
}

export class StockMovementDto {
  @ApiProperty(idSchema)
  id: number;

  @ApiProperty(idSchema)
  productId: number;

  @ApiProperty({ example: 'Maceta geométrica' })
  productName: string;

  @ApiProperty({ enum: movementTypes })
  type: MovementType;

  @ApiProperty({
    type: 'integer',
    example: -2,
    description:
      'Cantidad con signo. Positivo indica entrada y negativo indica salida.',
  })
  quantityDelta: number;

  @ApiProperty({ type: String, nullable: true, example: 'Piezas dañadas.' })
  reason: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-21T15:30:00.000Z',
  })
  occurredAt: string;

  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-4111-8111-111111111111',
  })
  createdBy: string;

  @ApiProperty({ example: 'Pedro' })
  createdByName: string;
}

export class StockChangeDto {
  @ApiProperty({ type: StockMovementDto })
  movement: StockMovementDto;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    example: 10,
  })
  stockBefore: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    example: 8,
  })
  stockAfter: number;
}
