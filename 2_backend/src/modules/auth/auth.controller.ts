import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../../common/api-errors.js';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { AccessToken, CurrentUser, Public } from './auth.http.js';
import {
  AccessUserDto,
  EmailDto,
  LoginDto,
  MessageDto,
  PasswordDto,
  RefreshDto,
  SessionDto,
  VerifyDto,
} from './auth.dto.js';
import type { AccessUser } from './auth.types.js';

@ApiTags('Auth')
@ApiErrors(500)
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    operationId: 'authLogin',
    summary: 'Inicia sesión con correo y contraseña',
    description:
      'Acceso público para cuentas invitadas que ya definieron contraseña. Comprueba que la sesión, el perfil y el rol sigan activos. Devuelve ambos tokens y el perfil actual. Límite de Nest: 10 intentos por minuto e IP.',
  })
  @ApiOkResponse({
    type: SessionDto,
    description: 'Sesión iniciada y acceso a la aplicación confirmado.',
  })
  @ApiErrors(400, 401, 403, 429, 503)
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    operationId: 'authRefreshSession',
    summary: 'Renueva la sesión y vuelve a comprobar el acceso',
    description:
      'Recibe el refresh token vigente; no requiere un access token en la cabecera. Reemplazar el par de tokens guardado por el devuelto y evitar renovaciones simultáneas de la misma sesión. Un perfil desactivado obtiene 403. Límite de Nest: 30 peticiones por minuto e IP.',
  })
  @ApiOkResponse({
    type: SessionDto,
    description: 'Tokens vigentes y perfil actual.',
  })
  @ApiErrors(400, 401, 403, 429, 503)
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    operationId: 'authVerifyLink',
    summary:
      'Verifica una invitación o recuperación de contraseña de un solo uso',
    description:
      'El frontend toma token_hash del enlace recibido por correo, lo elimina de la URL y lo envía aquí con type invite o recovery. Guardar la sesión recibida y usar PATCH /api/auth/password para definir la contraseña. El enlace verificado acredita el correo y permite acceder si el perfil está activo. Límite de Nest: 10 intentos por minuto e IP.',
  })
  @ApiOkResponse({
    type: SessionDto,
    description: 'Enlace consumido y sesión del usuario verificado.',
  })
  @ApiErrors(400, 401, 403, 429, 503)
  verify(@Body() body: VerifyDto) {
    return this.auth.verify(body.tokenHash, body.type);
  }

  @ApiBearerAuth()
  @Patch('password')
  @ApiOperation({
    operationId: 'authChangePassword',
    summary: 'Define o cambia la contraseña de la sesión actual',
    description:
      'Requiere el access token Bearer y el refresh token de la misma sesión. La nueva contraseña tiene entre 12 y 128 caracteres y debe cumplir la política de Supabase. Conservar los tokens devueltos, porque pueden renovarse durante la operación. Ante un 400 de contraseña se puede corregir el cuerpo y reintentar usando la sesión ya verificada.',
  })
  @ApiOkResponse({
    type: SessionDto,
    description:
      'Contraseña actualizada; sesión vigente que debe conservar el cliente.',
  })
  @ApiErrors(400, 401, 403, 429, 503)
  async password(
    @CurrentUser() user: AccessUser,
    @AccessToken() token: string,
    @Body() body: PasswordDto,
  ) {
    return this.auth.changePassword(
      user.id,
      token,
      body.refreshToken,
      body.password,
    );
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    operationId: 'authRequestPasswordReset',
    summary: 'Solicita recuperación sin revelar si el correo existe',
    description:
      'Acceso público. La respuesta aceptada es la misma para un correo existente o desconocido. Si corresponde, se envía un enlace para POST /api/auth/verify con type recovery. Límite de Nest: 3 solicitudes por minuto e IP; el proveedor también aplica límites de correo.',
  })
  @ApiAcceptedResponse({
    type: MessageDto,
    description:
      'Solicitud recibida; no confirma que el correo pertenezca a una cuenta.',
    example: {
      message: 'Si la cuenta existe, recibirás instrucciones por correo.',
    },
  })
  @ApiErrors(400, 401, 429, 503)
  forgot(@Body() body: EmailDto) {
    return this.auth.forgotPassword(body.email);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'authLogout',
    summary: 'Cierra la sesión actual',
    description:
      'Revoca la sesión del token Bearer presentado. El frontend debe borrar sus tokens y perfil locales tras el 204. La API rechaza los JWT de esa sesión desde las siguientes peticiones, aunque todavía no hayan expirado. Otras sesiones del usuario permanecen abiertas.',
  })
  @ApiNoContentResponse({
    description: 'Sesión cerrada; respuesta sin cuerpo.',
  })
  @ApiErrors(401, 403, 429, 503)
  async logout(@AccessToken() token: string): Promise<void> {
    await this.auth.logout(token);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    operationId: 'authGetCurrentUser',
    summary: 'Consulta la identidad y permisos actuales',
    description:
      'Comprueba el JWT y la sesión con el proveedor y consulta el perfil y rol activos en PostgreSQL. No devuelve tokens. Un usuario autenticado en Supabase sin perfil autorizado obtiene 403.',
  })
  @ApiOkResponse({
    type: AccessUserDto,
    description: 'Identidad y rol actuales del miembro activo.',
  })
  @ApiErrors(401, 403, 429, 503)
  me(@CurrentUser() user: AccessUser) {
    return user;
  }
}
