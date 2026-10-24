import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessUser } from './auth.types.js';

export const PUBLIC_ROUTE = 'access:public';
export const ADMIN_ROUTE = 'access:admin';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const AdminOnly = () => SetMetadata(ADMIN_ROUTE, true);

export interface AuthenticatedRequest extends Request {
  accessUser: AccessUser;
  accessToken: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AccessUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().accessUser,
);

export const AccessToken = createParamDecorator(
  (_: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().accessToken,
);
