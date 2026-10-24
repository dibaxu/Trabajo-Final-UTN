import { ApiProperty } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' }) status: 'ok';
  @ApiProperty({ enum: ['up'], example: 'up' }) database: 'up';
}

export class HealthUnavailableDto {
  @ApiProperty({ enum: ['error'], example: 'error' }) status: 'error';
  @ApiProperty({ enum: ['down'], example: 'down' }) database: 'down';
}
