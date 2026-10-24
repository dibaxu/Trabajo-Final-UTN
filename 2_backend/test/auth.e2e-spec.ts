import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../dist/config/configure-app.js';
import { DATABASE_POOL } from '../dist/infrastructure/database/database.provider.js';
import { AuthRepository } from '../dist/modules/auth/auth.repository.js';
import { SupabaseAuthGateway } from '../dist/modules/auth/supabase-auth.gateway.js';

const id = '11111111-1111-4111-8111-111111111111';
const sid = '22222222-2222-4222-8222-222222222222';
const member = {
  id,
  email: 'admin@example.com',
  displayName: 'Admin',
  role: 'ADMINISTRADOR',
  isActive: true,
  roleIsActive: true,
  emailConfirmed: true,
  invitedBy: null,
};
const tokens = {
  accessToken: 'valid-token',
  refreshToken: 'refresh',
  expiresIn: 3600,
  expiresAt: 9999999999,
  tokenType: 'bearer',
};

@Controller('protected-probe')
class ProtectedProbe {
  @Get()
  get() {
    return { protected: true };
  }
}

describe('API de acceso (HTTP sobre la compilación de producción)', () => {
  let app: INestApplication;
  const members = {
    findMember: vi.fn(),
    isSessionActive: vi.fn(),
    findAccount: vi.fn(),
    provisionMember: vi.fn(),
    listMembers: vi.fn(),
    setStatus: vi.fn(),
  };
  const identity = {
    identify: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    verify: vi.fn(),
    logout: vi.fn(),
    createAccount: vi.fn(),
    invite: vi.fn(),
    recover: vi.fn(),
    changePassword: vi.fn(),
  };

  beforeAll(async () => {
    for (const [name, value] of Object.entries({
      NODE_ENV: 'test',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://postgres:test@localhost:54322/postgres',
      DATABASE_SSL: 'false',
      DATABASE_CA_PATH: '',
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
    }))
      vi.stubEnv(name, value);
    const { AppModule } = await import('../dist/app.module.js');
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedProbe],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        on: vi.fn(),
        end: vi.fn(),
      })
      .overrideProvider(AuthRepository)
      .useValue(members)
      .overrideProvider(SupabaseAuthGateway)
      .useValue(identity)
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    members.findMember.mockResolvedValue({ ...member });
    members.isSessionActive.mockResolvedValue(true);
    members.listMembers.mockResolvedValue([member]);
    members.findAccount.mockResolvedValue(undefined);
    identity.identify.mockImplementation(async (token: string) => {
      if (token !== tokens.accessToken) throw new UnauthorizedException();
      return { id, sessionId: sid };
    });
    identity.login.mockResolvedValue(tokens);
    identity.refresh.mockResolvedValue(tokens);
    identity.verify.mockResolvedValue(tokens);
    identity.createAccount.mockResolvedValue(
      '33333333-3333-4333-8333-333333333333',
    );
    identity.changePassword.mockResolvedValue(tokens);
  });

  it('protege automáticamente un endpoint nuevo sin decoradores de acceso', async () => {
    await request(app.getHttpServer()).get('/api/protected-probe').expect(401);
    await request(app.getHttpServer())
      .get('/api/protected-probe')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);
  });

  it('normaliza el correo, entrega solo el perfil público e impide cachear tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: '  ADMIN@example.com ', password: 'some-password' })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(identity.login).toHaveBeenCalledWith(
      'admin@example.com',
      'some-password',
    );
    expect(response.body.user).toEqual({
      id,
      email: member.email,
      displayName: member.displayName,
      role: member.role,
    });
    expect(response.body).toMatchObject(tokens);
    expect(response.body.user).not.toHaveProperty('roleIsActive');
  });

  it('rechaza propiedades extra y cuerpos inválidos antes de llamar a Supabase', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'bad-email', password: 'x' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: member.email, password: 'x', role: 'ADMINISTRADOR' })
      .expect(400);
    expect(identity.login).not.toHaveBeenCalled();
  });

  it('no ofrece registro público', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'new@example.com' })
      .expect(404);
  });

  it('rechaza tokens falsos y usuarios desactivados', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer forged-token')
      .expect(401);
    members.findMember.mockResolvedValue({ ...member, isActive: false });
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
  });

  it('rechaza un JWT aceptado por Auth cuya sesión ya fue cerrada', async () => {
    members.isSessionActive.mockResolvedValue(false);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(401);
  });

  it('renueva tokens y comprueba otra vez el acceso a la aplicación', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'previous-refresh' })
      .expect(200);
    expect(identity.refresh).toHaveBeenCalledWith('previous-refresh');
    expect(members.isSessionActive).toHaveBeenCalledWith(id, sid);
  });

  it('consume invitación y permite definir la contraseña con la sesión devuelta', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ type: 'invite', tokenHash: 'one-time-hash' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/auth/password')
      .set('Authorization', 'Bearer valid-token')
      .send({ refreshToken: 'refresh', password: 'a-long-password' })
      .expect(200);
    expect(identity.verify).toHaveBeenCalledWith('one-time-hash', 'invite');
    expect(identity.changePassword).toHaveBeenCalledWith(
      id,
      'valid-token',
      'refresh',
      'a-long-password',
    );
  });

  it('limita los tipos de enlace y la longitud de contraseña', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ type: 'signup', tokenHash: 'hash' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/auth/password')
      .set('Authorization', 'Bearer valid-token')
      .send({ refreshToken: 'refresh', password: 'short' })
      .expect(400);
    expect(identity.verify).not.toHaveBeenCalled();
    expect(identity.changePassword).not.toHaveBeenCalled();
  });

  it('devuelve un mensaje genérico de recuperación', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: member.email })
      .expect(202);
    const second = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(202);
    expect(first.body).toEqual(second.body);
  });

  it('solo permite invitaciones a administradores y no acepta roles del cliente', async () => {
    members.findMember.mockResolvedValue({ ...member, role: 'LECTOR' });
    await request(app.getHttpServer())
      .post('/api/users/invitations')
      .set('Authorization', 'Bearer valid-token')
      .send({ email: 'new@example.com', displayName: 'Persona' })
      .expect(403);
    members.findMember.mockResolvedValue(member);
    await request(app.getHttpServer())
      .post('/api/users/invitations')
      .set('Authorization', 'Bearer valid-token')
      .send({
        email: 'new@example.com',
        displayName: 'Persona',
        role: 'ADMINISTRADOR',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/users/invitations')
      .set('Authorization', 'Bearer valid-token')
      .send({ email: 'new@example.com', displayName: 'Persona' })
      .expect(202);
    expect(members.provisionMember).toHaveBeenCalledWith(
      expect.any(String),
      'Persona',
      id,
    );
  });

  it('valida UUID y booleano en los cambios de estado', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/bad-id/status')
      .set('Authorization', 'Bearer valid-token')
      .send({ isActive: false })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/users/${id}/status`)
      .set('Authorization', 'Bearer valid-token')
      .send({ isActive: 'false' })
      .expect(400);
    expect(members.setStatus).not.toHaveBeenCalled();
  });

  it('cierra la sesión actual sin devolver cuerpo', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer valid-token')
      .expect(204);
    expect(identity.logout).toHaveBeenCalledWith('valid-token');
  });

  it('publica los endpoints y DTO reales en OpenAPI', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(body.paths['/api/users/invitations'].post.security).toEqual([
      { bearer: [] },
    ]);
    expect(body.paths['/api/auth/login'].post.security).toBeUndefined();
    expect(body.components.schemas.LoginDto.required).toContain('email');
    expect(body.components.schemas.SessionDto.properties.user).toBeDefined();
  });

  it('limita intentos de login antes de llegar al proveedor', async () => {
    let status = 0;
    for (let i = 0; i < 11 && status !== 429; i++) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: member.email, password: 'some-password' });
      status = response.status;
    }
    expect(status).toBe(429);
    expect(identity.login.mock.calls.length).toBeLessThan(11);
  });

  afterAll(async () => {
    if (app) await app.close();
    vi.unstubAllEnvs();
  });
});
