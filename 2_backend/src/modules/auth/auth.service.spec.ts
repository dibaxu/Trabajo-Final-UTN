import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthRepository } from './auth.repository.js';
import type { SupabaseAuthGateway } from './supabase-auth.gateway.js';
import type { Member } from './auth.types.js';

const member: Member = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  displayName: 'Admin',
  role: 'ADMINISTRADOR',
  isActive: true,
  roleIsActive: true,
  emailConfirmed: true,
  invitedBy: null,
};
const tokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresIn: 3600,
  expiresAt: 9999999999,
  tokenType: 'bearer' as const,
};

function setup() {
  const members = {
    findMember: vi.fn().mockResolvedValue({ ...member }),
    isSessionActive: vi.fn().mockResolvedValue(true),
    findAccount: vi.fn().mockResolvedValue(undefined),
    provisionMember: vi.fn().mockResolvedValue(undefined),
    listMembers: vi.fn().mockResolvedValue([member]),
    setStatus: vi.fn(),
  };
  const identity = {
    identify: vi
      .fn()
      .mockResolvedValue({ id: member.id, sessionId: 'session' }),
    login: vi.fn().mockResolvedValue(tokens),
    refresh: vi.fn().mockResolvedValue(tokens),
    verify: vi.fn().mockResolvedValue(tokens),
    logout: vi.fn().mockResolvedValue(undefined),
    createAccount: vi.fn().mockResolvedValue('new-user'),
    invite: vi.fn().mockResolvedValue(undefined),
    recover: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn(),
  };
  const service = new AuthService(
    members as unknown as AuthRepository,
    identity as unknown as SupabaseAuthGateway,
  );
  return { service, members, identity };
}

describe('Reglas del módulo de acceso', () => {
  it('entrega la sesión con el perfil actual y una interfaz de identidad pequeña', async () => {
    const { service } = setup();
    await expect(service.login(member.email, 'password')).resolves.toEqual({
      ...tokens,
      user: {
        id: member.id,
        email: member.email,
        displayName: member.displayName,
        role: member.role,
      },
    });
  });

  it.each([
    undefined,
    { ...member, isActive: false },
    { ...member, roleIsActive: false },
    { ...member, emailConfirmed: false },
  ])('rechaza una identidad sin pertenencia activa: %j', async (profile) => {
    const { service, members, identity } = setup();
    members.findMember.mockResolvedValue(profile);
    await expect(service.refresh('refresh')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(identity.logout).toHaveBeenCalledWith(tokens.accessToken);
  });

  it('rechaza una sesión revocada aunque el proveedor acepte el JWT', async () => {
    const { service, members } = setup();
    members.isSessionActive.mockResolvedValue(false);
    await expect(service.authenticate('valid-jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('vuelve a consultar el estado y rol en cada petición', async () => {
    const { service, members } = setup();
    await service.authenticate('valid-jwt');
    members.findMember.mockResolvedValue({ ...member, isActive: false });
    await expect(service.authenticate('valid-jwt')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(members.findMember).toHaveBeenCalledTimes(2);
  });

  it('crea identidad y perfil antes de enviar el correo', async () => {
    const { service, members, identity } = setup();
    await service.invite(member, 'new@example.com', 'Persona');
    expect(members.provisionMember).toHaveBeenCalledWith(
      'new-user',
      'Persona',
      member.id,
    );
    expect(identity.createAccount.mock.invocationCallOrder[0]).toBeLessThan(
      members.provisionMember.mock.invocationCallOrder[0],
    );
    expect(members.provisionMember.mock.invocationCallOrder[0]).toBeLessThan(
      identity.invite.mock.invocationCallOrder[0],
    );
  });

  it('reintenta el envío fallido reutilizando la cuenta pendiente', async () => {
    const { service, members, identity } = setup();
    identity.invite.mockRejectedValueOnce(new ServiceUnavailableException());
    await expect(
      service.invite(member, 'new@example.com', 'Persona'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    members.findAccount.mockResolvedValue({
      id: 'new-user',
      emailConfirmed: false,
      isActive: true,
    });
    await service.invite(member, 'new@example.com', 'Persona');
    expect(identity.createAccount).toHaveBeenCalledTimes(1);
    expect(identity.invite).toHaveBeenCalledTimes(2);
  });

  it('no envía un enlace si falla la creación del perfil', async () => {
    const { service, members, identity } = setup();
    members.provisionMember.mockRejectedValue(new Error('db unavailable'));
    await expect(
      service.invite(member, 'new@example.com', 'Persona'),
    ).rejects.toThrow();
    expect(identity.invite).not.toHaveBeenCalled();
  });

  it.each([
    [{ id: 'other', emailConfirmed: true, isActive: true }, ConflictException],
    [
      { id: 'other', emailConfirmed: false, isActive: false },
      ForbiddenException,
    ],
  ])(
    'no reinvita ni reactiva una cuenta incompatible: %j',
    async (account, errorType) => {
      const { service, members, identity } = setup();
      members.findAccount.mockResolvedValue(account);
      await expect(
        service.invite(member, 'other@example.com', 'Persona'),
      ).rejects.toBeInstanceOf(errorType);
      expect(identity.invite).not.toHaveBeenCalled();
      expect(members.provisionMember).not.toHaveBeenCalled();
    },
  );

  it('recupera una cuenta pendiente creada por una invitación concurrente', async () => {
    const { service, members, identity } = setup();
    identity.createAccount.mockRejectedValue(new ConflictException());
    members.findAccount.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      id: 'concurrent',
      emailConfirmed: false,
      isActive: true,
    });
    await service.invite(member, 'new@example.com', 'Persona');
    expect(members.provisionMember).toHaveBeenCalledWith(
      'concurrent',
      'Persona',
      member.id,
    );
  });
});
