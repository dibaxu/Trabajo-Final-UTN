import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Environment } from '../../config/env.validation.js';

export const SUPABASE_CLIENT_FACTORY = Symbol('SUPABASE_CLIENT_FACTORY');
export type SupabaseClientFactory = (admin?: boolean) => SupabaseClient;

export const supabaseClientProvider = {
  provide: SUPABASE_CLIENT_FACTORY,
  inject: [ConfigService],
  // Las operaciones de Auth mutan la sesión del SDK: nunca compartir el cliente.
  useFactory:
    (config: ConfigService<Environment, true>): SupabaseClientFactory =>
    (admin = false) =>
      createClient(
        config.get('SUPABASE_URL', { infer: true }),
        config.get(admin ? 'SUPABASE_SECRET_KEY' : 'SUPABASE_PUBLISHABLE_KEY', {
          infer: true,
        }),
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      ),
};
