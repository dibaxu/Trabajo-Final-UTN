import { Module } from '@nestjs/common';
import {
  SUPABASE_CLIENT,
  supabaseClientProvider,
} from './supabase.provider.js';

@Module({
  providers: [supabaseClientProvider],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
