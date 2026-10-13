import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import type { Environment } from '../../config/env.validation.js';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

export const databasePoolProvider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Environment, true>): Pool => {
    const url = new URL(config.get('DATABASE_URL', { infer: true }));
    // pg permite que los parámetros de la URL reemplacen el objeto ssl.
    // Centralizamos TLS en las variables DATABASE_SSL y DATABASE_CA_PATH.
    for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      url.searchParams.delete(key);
    }

    const caPath = config.get('DATABASE_CA_PATH', { infer: true });
    let ca: string | undefined;
    if (caPath) {
      try {
        ca = readFileSync(caPath, 'utf8');
      } catch {
        throw new Error(
          'No se pudo leer DATABASE_CA_PATH. Descargá el certificado CA de Supabase y revisá su ruta.',
        );
      }
    }

    return new Pool({
      connectionString: url.href,
      max: config.get('DATABASE_POOL_MAX', { infer: true }),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      ssl: config.get('DATABASE_SSL', { infer: true })
        ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) }
        : false,
    });
  },
};
