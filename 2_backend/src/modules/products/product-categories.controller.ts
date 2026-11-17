import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
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
import { AdminOnly } from '../auth/auth.http.js';
import {
  CatalogIdDto,
  CreateCategoryDto,
  ProductCategoryDto,
  UpdateCategoryDto,
} from './products.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('Product Categories')
@ApiBearerAuth()
@ApiErrors(401, 403, 429, 500, 503)
@Controller('product-categories')
export class ProductCategoriesController {
  constructor(
    @Inject(ProductsService) private readonly products: ProductsService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'productCategoriesList',
    summary: 'Lista categorías de productos',
    description:
      'Incluye categorías activas e inactivas para poder mostrar las asignaciones existentes.',
  })
  @ApiOkResponse({
    type: [ProductCategoryDto],
    description: 'Categorías ordenadas por nombre e identificador.',
  })
  list() {
    return this.products.listCategories();
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    operationId: 'productCategoriesCreate',
    summary: 'Crea una categoría de productos',
    description:
      'Requiere administrador. Crea una categoría activa con un nombre único, sin distinguir mayúsculas.',
  })
  @ApiCreatedResponse({
    type: ProductCategoryDto,
    description: 'Categoría creada.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Ya existe una categoría con el mismo nombre.',
  })
  @ApiErrors(400)
  create(@Body() input: CreateCategoryDto) {
    return this.products.createCategory(input);
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({
    operationId: 'productCategoriesUpdate',
    summary: 'Edita una categoría de productos',
    description:
      'Requiere administrador. Permite renombrarla o cambiar su estado. Desactivarla conserva los productos ya asociados.',
  })
  @ApiOkResponse({
    type: ProductCategoryDto,
    description: 'Categoría actualizada.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'La categoría no existe.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Ya existe una categoría con el mismo nombre.',
  })
  @ApiErrors(400)
  update(@Param() params: CatalogIdDto, @Body() input: UpdateCategoryDto) {
    return this.products.updateCategory(params.id, input);
  }
}
