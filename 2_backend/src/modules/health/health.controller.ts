import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../../infrastructure/database/database.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Comprueba que la API puede consultar PostgreSQL' })
  @ApiResponse({ status: 200, description: 'API y base de datos disponibles.' })
  @ApiResponse({ status: 503, description: 'Base de datos no disponible.' })
  async check() {
    try {
      await this.database.ping();
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
  }
}
