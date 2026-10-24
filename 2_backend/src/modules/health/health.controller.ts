import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthDto, HealthUnavailableDto } from './health.dto.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { Public } from '../auth/auth.http.js';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'healthCheck',
    summary: 'Comprueba que la API puede consultar PostgreSQL',
    description:
      'Endpoint público de disponibilidad. Ejecuta una consulta mínima a PostgreSQL; no requiere JWT y no usa el limitador de peticiones de acceso. El error 503 conserva el cuerpo de salud, distinto del formato general de errores.',
  })
  @ApiOkResponse({
    type: HealthDto,
    description: 'API y base de datos disponibles.',
  })
  @ApiServiceUnavailableResponse({
    type: HealthUnavailableDto,
    description: 'Base de datos no disponible.',
  })
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
