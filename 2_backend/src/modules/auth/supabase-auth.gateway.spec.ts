import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SupabaseAuthGateway } from './supabase-auth.gateway.js';
import type { Environment } from '../../config/env.validation.js';

const id = '11111111-1111-4111-8111-111111111111';
const sid = '22222222-2222-4222-8222-222222222222';
const jwt = (claims: object) =>
  `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, session_id: sid, exp: Math.floor(Date.now() / 1000) + 3600, ...claims })).toString('base64url')}.${Buffer.from('signature').toString('base64url')}`;
const user = {
  id,
  aud: 'authenticated',
  email: 'admin@example.com',
  created_at: new Date().toISOString(),
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-supabase-api-version': '2024-01-01',
    },
  });

function setup() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const factory = vi.fn((admin = false) =>
    createClient(
      'http://localhost:54321',
      admin ? 'sb_secret_test' : 'sb_publishable_test',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch },
      },
    ),
  );
  const config = new ConfigService<Environment, true>({
    FRONTEND_ORIGIN: 'http://localhost:5173',
  });
  return { gateway: new SupabaseAuthGateway(factory, config), fetch, factory };
}

describe('Adaptador Supabase Auth con el SDK real', () => {
  it('valida el token con Auth antes de leer session_id', async () => {
    const { gateway, fetch } = setup();
    fetch.mockResolvedValue(response(user));
    const token = jwt({});
    await expect(gateway.identify(token)).resolves.toEqual({
      id,
      sessionId: sid,
    });
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:54321/auth/v1/user');
    expect(
      new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization'),
    ).toBe(`Bearer ${token}`);
  });

  it.each([
    { session_id: null },
    { session_id: 'malformed' },
    { sub: 'other' },
  ])('rechaza claims incompatibles: %j', async (claims) => {
    const { gateway, fetch } = setup();
    fetch.mockResolvedValue(response(user));
    await expect(gateway.identify(jwt(claims))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('no confía en un JWT que Auth rechaza', async () => {
    const { gateway, fetch } = setup();
    fetch.mockResolvedValue(
      response({ code: 'bad_jwt', msg: 'invalid signature' }, 403),
    );
    await expect(gateway.identify(jwt({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([
    [503, 'unexpected_failure', ServiceUnavailableException],
    [429, 'over_request_rate_limit', HttpException],
    [400, 'invalid_credentials', UnauthorizedException],
  ] as const)(
    'traduce un error %s sin exponer mensajes privados',
    async (status, code, errorType) => {
      const { gateway, fetch } = setup();
      fetch.mockResolvedValue(
        response({ code, msg: 'PRIVATE_CREDENTIAL' }, status),
      );
      const failure = gateway.login('admin@example.com', 'password');
      await expect(failure).rejects.toBeInstanceOf(errorType);
      await expect(failure).rejects.not.toThrow('PRIVATE_CREDENTIAL');
    },
  );

  it('crea la cuenta sin contraseña ni confirmación y usa la clave administrativa', async () => {
    const { gateway, fetch, factory } = setup();
    fetch.mockResolvedValue(response(user));
    await gateway.createAccount('new@example.com');
    const init = fetch.mock.calls[0][1];
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    expect(body).toMatchObject({
      email: 'new@example.com',
      email_confirm: false,
    });
    expect(body).not.toHaveProperty('password');
    expect(factory).toHaveBeenCalledWith(true);
  });

  it('revoca solo la sesión actual con el token del usuario', async () => {
    const { gateway, fetch } = setup();
    fetch.mockResolvedValue(new Response(null, { status: 204 }));
    await gateway.logout('access-token');
    expect(fetch.mock.calls[0][0]).toBe(
      'http://localhost:54321/auth/v1/logout?scope=local',
    );
    expect(
      new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization'),
    ).toBe('Bearer access-token');
  });

  it('no confunde una clave administrativa inválida con una sesión del usuario inválida', async () => {
    const { gateway, fetch } = setup();
    fetch.mockResolvedValue(
      response({ code: 'not_admin', msg: 'PRIVATE_SERVER_KEY' }, 403),
    );
    await expect(
      gateway.createAccount('new@example.com'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('permite corregir una contraseña rechazada usando la sesión ya verificada', async () => {
    const { gateway, fetch } = setup();
    fetch
      .mockResolvedValueOnce(response(user))
      .mockResolvedValueOnce(
        response({ code: 'weak_password', msg: 'weak' }, 422),
      );
    await expect(
      gateway.changePassword(id, jwt({}), 'refresh', 'weak-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('devuelve la sesión vigente después del cambio de contraseña', async () => {
    const { gateway, fetch } = setup();
    fetch.mockImplementation(async () => response(user));
    const token = jwt({});
    await expect(
      gateway.changePassword(id, token, 'refresh', 'a-long-password'),
    ).resolves.toMatchObject({ accessToken: token, refreshToken: 'refresh' });
  });

  it('impide cambiar la contraseña si una renovación cambia la identidad', async () => {
    const { gateway, fetch } = setup();
    fetch.mockResolvedValue(response({ ...user, id: sid }));
    await expect(
      gateway.changePassword(id, jwt({}), 'refresh', 'a-long-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('crea un cliente distinto para cada operación y no mezcla sesiones', async () => {
    const { gateway, fetch, factory } = setup();
    fetch.mockImplementation(async () =>
      response({
        access_token: jwt({}),
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user,
      }),
    );
    await Promise.all([
      gateway.login('one@example.com', 'password'),
      gateway.login('two@example.com', 'password'),
    ]);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory.mock.results[0].value).not.toBe(
      factory.mock.results[1].value,
    );
  });
});
