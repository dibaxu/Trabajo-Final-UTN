import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';

@Module({ imports: [DatabaseModule, SupabaseModule] })
export class AuthModule {}
