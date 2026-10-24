import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import { ADMIN_ROUTE, PUBLIC_ROUTE } from './auth.http.js';
import type { AuthenticatedRequest } from './auth.http.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets))
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );
    if (!match)
      throw new UnauthorizedException('Se requiere una sesión válida.');
    request.accessToken = match[1];
    request.accessUser = await this.auth.authenticate(match[1]);
    if (
      this.reflector.getAllAndOverride<boolean>(ADMIN_ROUTE, targets) &&
      request.accessUser.role !== 'ADMINISTRADOR'
    ) {
      throw new ForbiddenException('Se requiere el rol de administrador.');
    }
    return true;
  }
}
