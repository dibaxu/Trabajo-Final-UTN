import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';

@Module({ imports: [DatabaseModule] })
export class ReportsModule {}
