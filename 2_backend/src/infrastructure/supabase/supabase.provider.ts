import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { Environment } from '../../config/env.validation.js';

export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT');

export const supabaseClientProvider = {
  provide: SUPABASE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Environment, true>) =>
    createClient(
      config.get('SUPABASE_URL', { infer: true }),
      config.get('SUPABASE_PUBLISHABLE_KEY', { infer: true }),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    ),
};
