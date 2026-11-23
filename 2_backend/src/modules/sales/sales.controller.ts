import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
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
  CreateReturnDto,
  CreateSaleDto,
  SaleDto,
  SaleIdDto,
  SaleReasonDto,
  SalesFiltersDto,
} from './sales.dto.js';
import { SalesService } from './sales.service.js';

@ApiTags('Sales')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 429, 500, 503)
@Controller('sales')
export class SalesController {
  constructor(@Inject(SalesService) private readonly sales: SalesService) {}

  @Get()
  @ApiOperation({
    operationId: 'salesList',
    summary: 'Lista ventas por período, estado y tipo',
    description:
      'Incluye detalles y devoluciones, ordenados por fecha e identificador descendentes. from y to incluyen ambos días en America/Argentina/Buenos_Aires. Los totales conservan los importes originales de la venta.',
  })
  @ApiOkResponse({
    type: [SaleDto],
    description: 'Lista completa de ventas que cumplen los filtros.',
  })
  list(@Query() filters: SalesFiltersDto) {
    return this.sales.list(filters);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'salesGet',
    summary: 'Consulta el detalle histórico de una venta',
    description:
      'Incluye el costo aplicado por detalle, devoluciones y datos de anulación.',
  })
  @ApiOkResponse({ type: SaleDto, description: 'Venta encontrada.' })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'La venta no existe.',
  })
  get(@Param() params: SaleIdDto) {
    return this.sales.get(params.id);
  }

  @Post()
  @ApiOperation({
    operationId: 'salesCreate',
    summary: 'Confirma una venta y descuenta existencias',
    description:
      'Requiere saleType MAYORISTA o MINORISTA y al menos un detalle con costo MANUAL explícito. Acumula productos repetidos con el mismo precio y costo. Calcula importes en el servidor y guarda venta, detalles y salidas en una transacción. Cada POST confirmado crea una venta nueva.',
  })
  @ApiCreatedResponse({
    type: SaleDto,
    description: 'Venta confirmada con existencias descontadas.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'Un producto no existe.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Existencias insuficientes para completar la venta.',
  })
  create(@Body() input: CreateSaleDto, @CurrentUser() actor: AccessUser) {
    return this.sales.create(input, actor.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @AdminOnly()
  @ApiOperation({
    operationId: 'salesCancel',
    summary: 'Anula una venta confirmada',
    description:
      'Requiere administrador y motivo. Restituye las unidades conservando los detalles y totales originales. Una venta con devoluciones o previamente anulada devuelve 409.',
  })
  @ApiOkResponse({
    type: SaleDto,
    description: 'Venta anulada y existencias restituidas.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'La venta no existe.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Estado incompatible con la anulación o stock fuera de rango.',
  })
  cancel(
    @Param() params: SaleIdDto,
    @Body() input: SaleReasonDto,
    @CurrentUser() actor: AccessUser,
  ) {
    return this.sales.cancel(params.id, input.reason, actor.id);
  }

  @Post(':id/returns')
  @AdminOnly()
  @ApiOperation({
    operationId: 'salesCreateReturn',
    summary: 'Registra una devolución parcial o total',
    description:
      'Requiere administrador, motivo y detalles de la venta original. Restituye las unidades y actualiza el estado en una transacción. Las cantidades repetidas del mismo detalle se acumulan.',
  })
  @ApiCreatedResponse({
    type: SaleDto,
    description:
      'Venta actualizada con su devolución y existencias restituidas.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'La venta no existe.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'La cantidad supera lo pendiente, el estado impide devolver o el stock queda fuera de rango.',
  })
  createReturn(
    @Param() params: SaleIdDto,
    @Body() input: CreateReturnDto,
    @CurrentUser() actor: AccessUser,
  ) {
    return this.sales.createReturn(params.id, input, actor.id);
  }
}
