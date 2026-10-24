import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthError, Session } from '@supabase/supabase-js';
import { SUPABASE_CLIENT_FACTORY } from '../../infrastructure/supabase/supabase.provider.js';
import type { SupabaseClientFactory } from '../../infrastructure/supabase/supabase.provider.js';
import type { Environment } from '../../config/env.validation.js';
import type { AuthIdentity, SessionTokens } from './auth.types.js';

@Injectable()
export class SupabaseAuthGateway {
  constructor(
    @Inject(SUPABASE_CLIENT_FACTORY)
    private readonly client: SupabaseClientFactory,
    @Inject(ConfigService)
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async login(email: string, password: string): Promise<SessionTokens> {
    const { data, error } = await this.client().auth.signInWithPassword({
      email,
      password,
    });
    this.check(error);
    return this.tokens(data.session);
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const { data, error } = await this.client().auth.refreshSession({
      refresh_token: refreshToken,
    });
    this.check(error);
    return this.tokens(data.session);
  }

  async verify(
    tokenHash: string,
    type: 'invite' | 'recovery',
  ): Promise<SessionTokens> {
    const { data, error } = await this.client().auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    this.check(error);
    return this.tokens(data.session);
  }

  async identify(accessToken: string): Promise<AuthIdentity> {
    // getUser valida el JWT en Auth. Solo después leemos session_id del mismo token.
    const { data, error } = await this.client().auth.getUser(accessToken);
    this.check(error);
    if (!data.user)
      throw new UnauthorizedException('Se requiere una sesión válida.');
    try {
      const claims = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64url').toString(),
      ) as Record<string, unknown>;
      if (
        claims.sub !== data.user.id ||
        typeof claims.session_id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          claims.session_id,
        )
      ) {
        throw new Error('Sesión inválida');
      }
      return { id: data.user.id, sessionId: claims.session_id };
    } catch {
      throw new UnauthorizedException('Se requiere una sesión válida.');
    }
  }

  async changePassword(
    userId: string,
    accessToken: string,
    refreshToken: string,
    password: string,
  ): Promise<SessionTokens> {
    const client = this.client();
    const { data, error: sessionError } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    this.check(sessionError);
    if (data.user?.id !== userId)
      throw new UnauthorizedException('La sesión no corresponde al usuario.');
    const { error } = await client.auth.updateUser({ password });
    this.check(error, 'password');
    // Solo serializar la sesión de esta operación; la autorización ya se verificó.
    const { data: current, error: currentError } =
      await client.auth.getSession();
    this.check(currentError);
    return this.tokens(current.session);
  }

  async logout(accessToken: string): Promise<void> {
    const { error } = await this.client().auth.admin.signOut(
      accessToken,
      'local',
    );
    this.check(error);
  }

  async createAccount(email: string): Promise<string> {
    const { data, error } = await this.client(true).auth.admin.createUser({
      email,
      email_confirm: false,
    });
    this.check(error, 'administration');
    if (!data.user)
      throw new ServiceUnavailableException('No se pudo crear la invitación.');
    return data.user.id;
  }

  async invite(email: string): Promise<void> {
    const { error } = await this.client(true).auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${this.config.get('FRONTEND_ORIGIN', { infer: true })}/auth/accept-invitation`,
      },
    );
    this.check(error, 'administration');
  }

  async recover(email: string): Promise<void> {
    const { error } = await this.client().auth.resetPasswordForEmail(email, {
      redirectTo: `${this.config.get('FRONTEND_ORIGIN', { infer: true })}/auth/reset-password`,
    });
    this.check(error);
  }

  private tokens(session: Session | null): SessionTokens {
    if (!session)
      throw new UnauthorizedException('No se pudo iniciar la sesión.');
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      expiresAt:
        session.expires_at ??
        Math.floor(Date.now() / 1000) + session.expires_in,
      tokenType: 'bearer',
    };
  }

  private check(
    error: AuthError | null,
    operation: 'credentials' | 'password' | 'administration' = 'credentials',
  ): void {
    if (!error) return;
    if (error.status === 429)
      throw new HttpException(
        'Demasiados intentos. Intentá más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    if (error.status === 0 || (error.status ?? 500) >= 500) {
      throw new ServiceUnavailableException(
        'El servicio de autenticación no está disponible.',
      );
    }
    if (['email_exists', 'user_already_exists'].includes(error.code ?? '')) {
      throw new ConflictException('La cuenta ya existe.');
    }
    if (operation === 'administration') {
      throw new ServiceUnavailableException(
        'No se pudo completar la invitación. Revisá la configuración de Auth y correo.',
      );
    }
    if (
      operation === 'password' &&
      ['weak_password', 'same_password', 'validation_failed'].includes(
        error.code ?? '',
      )
    ) {
      throw new BadRequestException(
        'La contraseña no cumple los requisitos o coincide con la actual.',
      );
    }
    throw new UnauthorizedException(
      'Credenciales o enlace inválidos o vencidos.',
    );
  }
}
