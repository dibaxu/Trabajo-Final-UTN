import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
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
  AdjustStockDto,
  MovementFiltersDto,
  RegisterProductionDto,
  StockChangeDto,
  StockDto,
  StockFiltersDto,
  StockMovementDto,
} from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('Inventory')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 429, 500, 503)
@Controller('stock')
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'stockList',
    summary: 'Consulta las existencias de productos activos',
    description:
      'Combina búsqueda por nombre o SKU, categoría y disponibilidad. Calcula el stock sumando movimientos; sin movimientos devuelve cero.',
  })
  @ApiOkResponse({
    type: [StockDto],
    description: 'Productos activos ordenados por nombre e identificador.',
  })
  list(@Query() filters: StockFiltersDto) {
    return this.inventory.listStock(filters);
  }

  @Get('movements')
  @AdminOnly()
  @ApiOperation({
    operationId: 'stockMovements',
    summary: 'Consulta el historial de movimientos',
    description:
      'Requiere administrador. Incluye productos activos e inactivos. Las fechas from y to incluyen ambos días en America/Argentina/Buenos_Aires. Los movimientos conservan fecha y usuario responsable.',
  })
  @ApiOkResponse({
    type: [StockMovementDto],
    description:
      'Movimientos ordenados por fecha e identificador descendentes.',
  })
  movements(@Query() filters: MovementFiltersDto) {
    return this.inventory.listMovements(filters);
  }

  @Post('production')
  @ApiOperation({
    operationId: 'stockRegisterProduction',
    summary: 'Registra unidades producidas',
    description:
      'Crea una entrada para un producto activo. La fecha y el usuario se asignan en el servidor. Cada POST confirmado registra una operación nueva.',
  })
  @ApiCreatedResponse({
    type: StockChangeDto,
    description:
      'Movimiento registrado y existencias antes y después de la operación.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'El producto no existe.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'El stock resultante supera el rango permitido.',
  })
  production(
    @Body() input: RegisterProductionDto,
    @CurrentUser() actor: AccessUser,
  ) {
    return this.inventory.registerProduction(input, actor.id);
  }

  @Post('adjustments')
  @AdminOnly()
  @ApiOperation({
    operationId: 'stockAdjust',
    summary: 'Ajusta las existencias con un motivo',
    description:
      'Requiere administrador y producto activo. Crea un movimiento positivo o negativo y comprueba el saldo dentro de la transacción. Cada POST confirmado registra una operación nueva.',
  })
  @ApiCreatedResponse({
    type: StockChangeDto,
    description:
      'Ajuste registrado y existencias antes y después de la operación.',
  })
  @ApiNotFoundResponse({
    type: ApiErrorDto,
    description: 'El producto no existe.',
  })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'El ajuste dejaría stock negativo o superaría el rango permitido.',
  })
  adjust(@Body() input: AdjustStockDto, @CurrentUser() actor: AccessUser) {
    return this.inventory.adjustStock(input, actor.id);
  }
}
