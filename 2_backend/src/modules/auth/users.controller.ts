import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../../common/api-errors.js';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { AdminOnly, CurrentUser } from './auth.http.js';
import { InviteDto, MemberDto, MessageDto, StatusDto } from './auth.dto.js';
import type { AccessUser } from './auth.types.js';

@ApiTags('Users')
@ApiBearerAuth()
@ApiErrors(401, 403, 429, 500, 503)
@AdminOnly()
@Controller('users')
export class UsersController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get()
  @ApiOperation({
    operationId: 'usersList',
    summary: 'Lista miembros e invitaciones pendientes',
    description:
      'Requiere ADMINISTRADOR activo. Devuelve la lista completa de perfiles, incluidos los desactivados y los correos todavía sin confirmar. El MVP no aplica paginación. emailConfirmed permite distinguir correos pendientes de confirmación.',
  })
  @ApiOkResponse({
    type: [MemberDto],
    description:
      'Miembros ordenados por creación e identificador; puede devolver una lista vacía.',
  })
  list() {
    return this.auth.listMembers();
  }

  @Post('invitations')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    operationId: 'usersInvite',
    summary: 'Invita o reenvía la invitación a una cuenta pendiente',
    description:
      'Requiere ADMINISTRADOR activo. Crea la cuenta sin contraseña y el perfil antes de enviar el correo. El rol se asigna en el servidor como ADMINISTRADOR. Un reintento reutiliza la cuenta pendiente sin cambiar su nombre, rol ni estado. Usar el enlace más reciente. Una cuenta confirmada devuelve 409; una desactivada requiere reactivación explícita y devuelve 403. Límite de Nest: 5 peticiones por minuto e IP.',
  })
  @ApiAcceptedResponse({
    type: MessageDto,
    description:
      'Invitación enviada; todavía falta que la persona confirme el correo.',
    example: { message: 'Invitación enviada.' },
  })
  @ApiErrors(400, 409)
  invite(@CurrentUser() actor: AccessUser, @Body() body: InviteDto) {
    return this.auth.invite(actor, body.email, body.displayName);
  }

  @Patch(':id/status')
  @ApiOperation({
    operationId: 'usersSetStatus',
    summary: 'Activa o desactiva un miembro sin borrar su historial',
    description:
      'Requiere ADMINISTRADOR activo. Desactivar impide las siguientes peticiones del usuario. Reactivar permite reutilizar sesiones que todavía sigan vigentes. No se puede desactivar el propio acceso. Se conserva la identidad y el historial del usuario.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    type: String,
    example: '22222222-2222-4222-8222-222222222222',
    description: 'Identificador del miembro cuyo estado se cambia.',
  })
  @ApiOkResponse({
    type: MemberDto,
    description: 'Perfil con el estado actualizado.',
  })
  @ApiErrors(400, 404)
  status(
    @CurrentUser() actor: AccessUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StatusDto,
  ) {
    return this.auth.setStatus(actor, id, body.isActive);
  }
}
