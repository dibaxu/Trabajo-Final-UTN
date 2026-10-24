import { validateEnv } from './env.validation.js';

const env = {
  FRONTEND_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://postgres:test@localhost:54322/postgres',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
};

describe('Validación de entorno', () => {
  it('convierte los valores y acepta PostgreSQL local sin TLS', () => {
    const config = validateEnv({
      ...env,
      PORT: '4000',
      DATABASE_SSL: 'false',
      DATABASE_CA_PATH: '',
    });
    expect(config.PORT).toBe(4000);
    expect(config.DATABASE_SSL).toBe(false);
    expect(config.DATABASE_CA_PATH).toBeUndefined();
  });

  it('rechaza deshabilitar TLS para una base remota', () => {
    expect(() =>
      validateEnv({
        ...env,
        DATABASE_URL: 'postgresql://postgres:test@db.example.com/postgres',
        DATABASE_SSL: 'false',
      }),
    ).toThrow('DATABASE_SSL');
  });

  it('informa la variable inválida sin filtrar su valor', () => {
    const secret = 'credencial-privada-no-es-una-url';
    try {
      validateEnv({ ...env, DATABASE_URL: secret });
      throw new Error('Se esperaba un rechazo de configuración');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('DATABASE_URL');
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('rechaza una clave secreta en el campo publicable y viceversa', () => {
    expect(() =>
      validateEnv({ ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private' }),
    ).toThrow('SUPABASE_PUBLISHABLE_KEY');
    expect(() =>
      validateEnv({ ...env, SUPABASE_SECRET_KEY: 'sb_publishable_test' }),
    ).toThrow('SUPABASE_SECRET_KEY');
  });

  it('requiere la clave administrativa sin incluirla en el mensaje de error', () => {
    expect(() =>
      validateEnv({ ...env, SUPABASE_SECRET_KEY: undefined }),
    ).toThrow('SUPABASE_SECRET_KEY');
  });
});
