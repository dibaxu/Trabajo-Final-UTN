import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRepository } from './auth.repository.js';
import { SupabaseAuthGateway } from './supabase-auth.gateway.js';
import type { AccessUser, Member, SessionTokens } from './auth.types.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository) private readonly members: AuthRepository,
    @Inject(SupabaseAuthGateway) private readonly identity: SupabaseAuthGateway,
  ) {}

  async authenticate(accessToken: string): Promise<AccessUser> {
    const identity = await this.identity.identify(accessToken);
    if (
      !(await this.members.isSessionActive(identity.id, identity.sessionId))
    ) {
      throw new UnauthorizedException('La sesión ya no está activa.');
    }
    const member = await this.members.findMember(identity.id);
    if (!member?.isActive || !member.roleIsActive || !member.emailConfirmed) {
      throw new ForbiddenException('No tenés acceso activo a esta aplicación.');
    }
    return {
      id: member.id,
      email: member.email,
      displayName: member.displayName,
      role: member.role,
    };
  }

  async login(email: string, password: string) {
    return this.session(await this.identity.login(email, password));
  }

  async refresh(refreshToken: string) {
    return this.session(await this.identity.refresh(refreshToken));
  }

  async verify(tokenHash: string, type: 'invite' | 'recovery') {
    return this.session(await this.identity.verify(tokenHash, type));
  }

  async changePassword(
    userId: string,
    accessToken: string,
    refreshToken: string,
    password: string,
  ) {
    return this.session(
      await this.identity.changePassword(
        userId,
        accessToken,
        refreshToken,
        password,
      ),
    );
  }

  async logout(accessToken: string): Promise<void> {
    await this.identity.logout(accessToken);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    // Supabase devuelve la misma respuesta para correos inexistentes y no crea cuentas.
    await this.identity.recover(email);
    return {
      message: 'Si la cuenta existe, recibirás instrucciones por correo.',
    };
  }

  async invite(actor: AccessUser, email: string, displayName: string) {
    let account = await this.members.findAccount(email);
    this.assertInvitable(account);
    let id = account?.id;
    if (!id) {
      try {
        id = await this.identity.createAccount(email);
      } catch (error) {
        // Dos solicitudes pueden intentar crear el mismo correo. Solo recuperar una cuenta pendiente.
        if (!(error instanceof ConflictException)) throw error;
        account = await this.members.findAccount(email);
        this.assertInvitable(account);
        if (!account) throw error;
        id = account.id;
      }
    }
    await this.members.provisionMember(id, displayName, actor.id);
    await this.identity.invite(email);
    return { message: 'Invitación enviada.' };
  }

  async listMembers() {
    return (await this.members.listMembers()).map((member) =>
      this.publicMember(member),
    );
  }

  async setStatus(actor: AccessUser, id: string, isActive: boolean) {
    return this.publicMember(
      await this.members.setStatus(actor.id, id, isActive),
    );
  }

  private assertInvitable(
    account: { emailConfirmed: boolean; isActive: boolean | null } | undefined,
  ): void {
    if (account?.isActive === false)
      throw new ForbiddenException(
        'Reactivá explícitamente al usuario antes de invitarlo.',
      );
    if (account?.emailConfirmed)
      throw new ConflictException('La cuenta ya confirmó su correo.');
  }

  private async session(tokens: SessionTokens) {
    try {
      const user = await this.authenticate(tokens.accessToken);
      return { ...tokens, user };
    } catch (error) {
      // No entregar tokens para identidades sin acceso; intentar cerrar la sesión recién emitida.
      await this.identity.logout(tokens.accessToken).catch(() => undefined);
      throw error;
    }
  }

  private publicMember(member: Member) {
    const { roleIsActive: _, ...result } = member;
    return result;
  }
}
