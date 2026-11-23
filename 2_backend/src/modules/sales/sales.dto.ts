import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const saleTypes = ['MAYORISTA', 'MINORISTA'] as const;
export const saleStatuses = [
  'CONFIRMADA',
  'ANULADA',
  'PARCIALMENTE_DEVUELTA',
  'DEVUELTA',
] as const;
const idSchema = {
  type: 'integer',
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
  example: 1,
} as const;
const quantitySchema = {
  type: 'integer',
  minimum: 1,
  maximum: 2_147_483_647,
  example: 2,
} as const;
const moneySchema = {
  minimum: 0,
  maximum: 9_999_999_999.99,
  multipleOf: 0.01,
  example: 1500,
};
// eslint-disable-next-line no-control-regex -- PostgreSQL no admite NUL en valores text.
const postgresText = /^[^\u0000]*$/;
const calendarDate = /^(?!0000)\d{4}-\d{2}-\d{2}$/;
const trim = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SaleIdDto {
  @ApiProperty(idSchema)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  id: number;
}

export class CreateSaleItemDto {
  @ApiProperty(idSchema)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  productId: number;

  @ApiProperty(quantitySchema)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  quantity: number;

  @ApiProperty(moneySchema)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  unitPrice: number;

  @ApiProperty({
    enum: ['MANUAL'],
    description:
      'El costo se indica explícitamente por detalle. Las estimaciones se incorporarán con Costos.',
  })
  @IsIn(['MANUAL'])
  costSource: 'MANUAL';

  @ApiProperty(moneySchema)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  unitCost: number;
}

export class CreateSaleDto {
  @ApiProperty({ enum: saleTypes })
  @IsIn(saleTypes)
  saleType: (typeof saleTypes)[number];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 300,
    example: 'Venta en feria.',
  })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString()
  @Matches(postgresText)
  @MaxLength(300)
  notes?: string | null;

  @ApiProperty({ type: [CreateSaleItemDto], minItems: 1 })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}

export class SalesFiltersDto {
  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-11-01' })
  @IsOptional()
  @Matches(calendarDate)
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-11-30' })
  @IsOptional()
  @Matches(calendarDate)
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({ enum: saleTypes })
  @IsOptional()
  @IsIn(saleTypes)
  saleType?: (typeof saleTypes)[number];

  @ApiPropertyOptional({ enum: saleStatuses })
  @IsOptional()
  @IsIn(saleStatuses)
  status?: (typeof saleStatuses)[number];
}

export class SaleReasonDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 200,
    example: 'Corrección de una operación.',
  })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @IsNotEmpty()
  @Matches(postgresText)
  @MaxLength(200)
  reason: string;
}

export class ReturnItemDto {
  @ApiProperty(idSchema)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  saleItemId: number;

  @ApiProperty(quantitySchema)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  quantity: number;
}

export class CreateReturnDto extends SaleReasonDto {
  @ApiProperty({ type: [ReturnItemDto], minItems: 1 })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}

export class SaleItemDto extends CreateSaleItemDto {
  @ApiProperty(idSchema)
  id: number;
  @ApiProperty({ example: 'Maceta geométrica' })
  productName: string;
  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: null,
    description: 'Se incorporará al implementar Costos.',
  })
  costEstimateId: number | null;
  @ApiProperty({ example: 3000 })
  lineTotal: number;
  @ApiProperty({ example: 2000 })
  lineCost: number;
  @ApiProperty({ example: 1000 })
  lineMargin: number;
  @ApiProperty({ type: 'integer', minimum: 0, example: 0 })
  returnedQuantity: number;
}

export class SaleReturnItemDto extends ReturnItemDto {
  @ApiProperty(idSchema)
  id: number;
}

export class SaleReturnDto {
  @ApiProperty(idSchema)
  id: number;
  @ApiProperty(idSchema)
  saleId: number;
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-22T15:00:00.000Z',
  })
  returnedAt: string;
  @ApiProperty({ example: 'Producto devuelto.' })
  reason: string;
  @ApiProperty({ format: 'uuid' })
  createdBy: string;
  @ApiProperty({ example: 'Pedro' })
  createdByName: string;
  @ApiProperty({ type: [SaleReturnItemDto] })
  items: SaleReturnItemDto[];
}

export class SaleDto {
  @ApiProperty(idSchema)
  id: number;
  @ApiProperty({ enum: saleStatuses })
  status: (typeof saleStatuses)[number];
  @ApiProperty({ enum: saleTypes })
  saleType: (typeof saleTypes)[number];
  @ApiProperty({ type: String, format: 'date-time' })
  soldAt: string;
  @ApiProperty({ example: 3000 })
  totalAmount: number;
  @ApiProperty({ example: 2000 })
  totalCost: number;
  @ApiProperty({ example: 1000 })
  grossMargin: number;
  @ApiProperty({ type: String, nullable: true, example: 'Venta en feria.' })
  notes: string | null;
  @ApiProperty({ format: 'uuid' })
  createdBy: string;
  @ApiProperty({ example: 'Pedro' })
  createdByName: string;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;
  @ApiProperty({ type: String, nullable: true, example: null })
  cancellationReason: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  cancelledBy: string | null;
  @ApiProperty({ type: String, nullable: true })
  cancelledByName: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cancelledAt: string | null;
  @ApiProperty({ type: [SaleItemDto] })
  items: SaleItemDto[];
  @ApiProperty({ type: [SaleReturnDto] })
  returns: SaleReturnDto[];
  @ApiProperty({ type: 'integer', example: 1 })
  itemCount: number;
  @ApiProperty({ type: 'integer', example: 2 })
  units: number;
}
