import { Module } from '@nestjs/common';
import { databasePoolProvider } from './database.provider.js';
import { DatabaseService } from './database.service.js';

@Module({
  providers: [databasePoolProvider, DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
