import { Module } from '@nestjs/common';
import {
  SUPABASE_CLIENT_FACTORY,
  supabaseClientProvider,
} from './supabase.provider.js';

@Module({
  providers: [supabaseClientProvider],
  exports: [SUPABASE_CLIENT_FACTORY],
})
export class SupabaseModule {}
