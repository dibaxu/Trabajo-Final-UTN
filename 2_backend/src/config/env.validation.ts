import { z } from 'zod';

const optionalPath = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

function isLegacyKey(value: string, role: string): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(value.split('.')[1] ?? '', 'base64url').toString(),
    ) as { role?: unknown };
    return payload.role === role;
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    FRONTEND_ORIGIN: z
      .url()
      .refine((value) => /^https?:\/\/[^/?#]+$/.test(value)),
    DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:\/\//.test(value)),
    DATABASE_SSL: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    DATABASE_CA_PATH: optionalPath,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
    SUPABASE_URL: z.url().refine((value) => /^https?:\/\//.test(value)),
    SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .trim()
      .min(1)
      .refine(
        (value) =>
          value.startsWith('sb_publishable_') || isLegacyKey(value, 'anon'),
      ),
    SUPABASE_SECRET_KEY: z
      .string()
      .trim()
      .min(1)
      .refine(
        (value) =>
          value.startsWith('sb_secret_') || isLegacyKey(value, 'service_role'),
      ),
  })
  .superRefine((env, context) => {
    let hostname: string;
    try {
      hostname = new URL(env.DATABASE_URL).hostname;
    } catch {
      return;
    }
    if (
      !env.DATABASE_SSL &&
      !['localhost', '127.0.0.1', '[::1]'].includes(hostname)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_SSL'],
        message: 'SSL solo puede deshabilitarse para PostgreSQL local.',
      });
    }
    if (!env.DATABASE_SSL && env.DATABASE_CA_PATH) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_CA_PATH'],
        message: 'El certificado CA requiere DATABASE_SSL=true.',
      });
    }
  });

export type Environment = z.infer<typeof envSchema>;

export function validateEnv(env: Record<string, unknown>): Environment {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.'))),
    ];
    // Los errores nunca incluyen valores de variables ni credenciales.
    throw new Error(`Configuración inválida. Revisá: ${fields.join(', ')}`);
  }
  return result.data;
}
