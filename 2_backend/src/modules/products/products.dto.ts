import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
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
  ValidateIf,
} from 'class-validator';

const maxAmount = 9_999_999_999.99;
const idSchema = {
  type: 'integer',
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
  example: 1,
} as const;
const statuses = ['active', 'inactive'] as const;
// eslint-disable-next-line no-control-regex -- PostgreSQL no admite NUL en valores text.
const postgresText = /^[^\u0000]*$/;

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CatalogIdDto {
  @ApiProperty(idSchema)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  id: number;
}

export class ProductFiltersDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Busca texto en el nombre o SKU, sin distinguir mayúsculas.',
  })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString()
  @Matches(postgresText)
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional(idSchema)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  categoryId?: number;

  @ApiPropertyOptional({ enum: statuses })
  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}

export class CatalogStatusDto {
  @ApiProperty({ example: true, description: 'Estado activo del registro.' })
  @IsBoolean()
  isActive: boolean;
}

export class CreateCategoryDto {
  @ApiProperty({ minLength: 1, maxLength: 60, example: 'Macetas' })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @IsNotEmpty()
  @Matches(postgresText)
  @MaxLength(60)
  name: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({ example: false })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class ProductCategoryDto {
  @ApiProperty(idSchema)
  id: number;

  @ApiProperty({ example: 'Macetas' })
  name: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class CreateProductDto {
  @ApiProperty({ minLength: 1, maxLength: 100, example: 'Maceta geométrica' })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @IsNotEmpty()
  @Matches(postgresText)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    ...idSchema,
    description: 'ID de la categoría activa a asignar.',
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  categoryId: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 40,
    example: 'MAC-01',
  })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString()
  @Matches(postgresText)
  @MaxLength(40)
  sku?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 500,
    example: 'Maceta impresa en PLA.',
  })
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsOptional()
  @IsString()
  @Matches(postgresText)
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: maxAmount,
    multipleOf: 0.01,
    default: 0,
    example: 3500,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(maxAmount)
  referenceSalePrice?: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: maxAmount,
    multipleOf: 0.01,
    example: 1200.5,
    description:
      'Costo cargado manualmente. null indica que todavía no se registró.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(maxAmount)
  manualCost?: number | null;

  @ApiPropertyOptional({ default: true, example: true })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['isActive']),
  { skipNullProperties: false },
) {}

export class ProductDto {
  @ApiProperty(idSchema)
  id: number;

  @ApiProperty({ example: 'Maceta geométrica' })
  name: string;

  @ApiProperty(idSchema)
  categoryId: number;

  @ApiProperty({ example: 'Macetas' })
  categoryName: string;

  @ApiProperty({ type: String, nullable: true, example: 'MAC-01' })
  sku: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Maceta impresa en PLA.',
  })
  description: string | null;

  @ApiProperty({ example: 3500 })
  referenceSalePrice: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 1200.5,
    description: 'Costo ingresado manualmente.',
  })
  manualCost: number | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({
    type: String,
    format: 'uri',
    nullable: true,
    example: null,
    description: 'URL de imagen. Devuelve null hasta integrar Storage.',
  })
  imageUrl: string | null;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: null,
    description: 'Existencias. Devuelve null hasta implementar Inventario.',
  })
  stock: number | null;
}
