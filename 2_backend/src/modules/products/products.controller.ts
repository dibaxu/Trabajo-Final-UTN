import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto, ApiErrors } from '../../common/api-errors.js';
import { AdminOnly, CurrentUser } from '../auth/auth.http.js';
import type { AccessUser } from '../auth/auth.types.js';
import {
  CatalogIdDto,
  CatalogStatusDto,
  CreateProductDto,
  ProductDto,
  ProductFiltersDto,
  UpdateProductDto,
} from './products.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('Products')
@ApiBearerAuth()
@ApiErrors(401, 403, 429, 500, 503)
@Controller('products')
export class ProductsController {
  constructor(
    @Inject(ProductsService) private readonly products: ProductsService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'productsList',
    summary: 'Lista productos',
    description:
      'Combina filtros opcionales de búsqueda, categoría y estado. Sin filtro de estado incluye activos e inactivos.',
  })
  @ApiOkResponse({
    type: [ProductDto],
    description: 'Productos ordenados por nombre e identificador.',
  })
  @ApiErrors(400)
  list(@Query() filters: ProductFiltersDto) {
    return this.products.listProducts(filters);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'productsGet',
    summary: 'Consulta un producto',
    description:
      'Devuelve el producto con el nombre de su categoría, incluso cuando el producto está inactivo.',
  })
  @ApiOkResponse({ type: ProductDto, description: 'Producto encontrado.' })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'El producto no existe.',
  })
  @ApiErrors(400)
  get(@Param() params: CatalogIdDto) {
    return this.products.getProduct(params.id);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    operationId: 'productsCreate',
    summary: 'Crea un producto',
    description:
      'Requiere administrador y una categoría activa. El producto puede crearse sin costo manual ni imagen.',
  })
  @ApiCreatedResponse({ type: ProductDto, description: 'Producto creado.' })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Ya existe un producto con el mismo SKU.',
  })
  @ApiErrors(400)
  create(@Body() input: CreateProductDto, @CurrentUser() actor: AccessUser) {
    return this.products.createProduct(input, actor.id);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({
    operationId: 'productsUpdate',
    summary: 'Edita un producto',
    description:
      'Requiere administrador. Los campos omitidos se conservan. Permite conservar la categoría actual si está inactiva y asignar otra categoría si está activa.',
  })
  @ApiOkResponse({ type: ProductDto, description: 'Producto actualizado.' })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'El producto no existe.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Ya existe un producto con el mismo SKU.',
  })
  @ApiErrors(400)
  update(@Param() params: CatalogIdDto, @Body() input: UpdateProductDto) {
    return this.products.updateProduct(params.id, input);
  }

  @Patch(':id/status')
  @AdminOnly()
  @ApiOperation({
    operationId: 'productsSetStatus',
    summary: 'Activa o desactiva un producto',
    description:
      'Requiere administrador. Conserva la identidad del producto y sus referencias históricas.',
  })
  @ApiOkResponse({
    type: ProductDto,
    description: 'Producto con el estado solicitado.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'El producto no existe.',
  })
  @ApiErrors(400)
  setStatus(@Param() params: CatalogIdDto, @Body() input: CatalogStatusDto) {
    return this.products.setProductStatus(params.id, input.isActive);
  }
}
