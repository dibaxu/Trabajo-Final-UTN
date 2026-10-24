import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EmailDto {
  @ApiProperty({
    format: 'email',
    example: 'persona@example.com',
    maxLength: 254,
    description:
      'Correo del usuario. La API elimina espacios externos y lo convierte a minúsculas.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty({
    format: 'password',
    minLength: 1,
    maxLength: 128,
    writeOnly: true,
    example: 'EjemploDeClave2026!',
    description:
      'Contraseña actual. El inicio de sesión admite credenciales existentes.',
  })
  @IsString()
  @Length(1, 128)
  password: string;
}

export class RefreshDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 4096,
    writeOnly: true,
    example: 'refresh-token-ficticio',
    description:
      'Refresh token vigente de la sesión. Conservar el nuevo par de tokens devuelto por la API.',
  })
  @IsString()
  @Length(1, 4096)
  refreshToken: string;
}

export class VerifyDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 2048,
    writeOnly: true,
    example: 'hash-ficticio-del-enlace',
    description:
      'token_hash del enlace recibido por correo, de un solo uso. Se envía por POST en el cuerpo.',
  })
  @IsString()
  @Length(1, 2048)
  tokenHash: string;

  @ApiProperty({
    enum: ['invite', 'recovery'],
    example: 'invite',
    description: 'Tipo del correo que originó el enlace.',
  })
  @IsIn(['invite', 'recovery'])
  type: 'invite' | 'recovery';
}

export class PasswordDto extends RefreshDto {
  @ApiProperty({
    format: 'password',
    minLength: 12,
    maxLength: 128,
    writeOnly: true,
    example: 'OtraClaveDeEjemplo2026!',
    description:
      'Nueva contraseña; Supabase también comprueba su política de seguridad.',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;
}

export class InviteDto extends EmailDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 100,
    example: 'María Pérez',
    description: 'Nombre visible; se eliminan espacios externos.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  displayName: string;
}

export class StatusDto {
  @ApiProperty({
    example: false,
    description:
      'false bloquea el acceso en las siguientes peticiones. true permite reutilizar las sesiones que todavía sigan vigentes.',
  })
  @IsBoolean()
  isActive: boolean;
}

export class AccessUserDto {
  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-4111-8111-111111111111',
    description:
      'Identificador del usuario en Supabase y del perfil de la aplicación.',
  })
  id: string;
  @ApiProperty({ format: 'email', example: 'persona@example.com' })
  email: string;
  @ApiProperty({ example: 'María Pérez' }) displayName: string;
  @ApiProperty({
    example: 'ADMINISTRADOR',
    description:
      'Rol actual consultado en PostgreSQL. En el MVP todos los miembros son ADMINISTRADOR.',
  })
  role: string;
}

export class SessionDto {
  @ApiProperty({
    example: 'access-token-ficticio',
    description:
      'JWT para Authorization: Bearer <accessToken>. El ejemplo no es una credencial válida.',
  })
  accessToken: string;
  @ApiProperty({
    example: 'refresh-token-ficticio',
    description:
      'Token para renovar esta sesión. Reemplazarlo por el valor devuelto en cada renovación.',
  })
  refreshToken: string;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 3600,
    description: 'Segundos de validez del access token.',
  })
  expiresIn: number;
  @ApiProperty({
    type: 'integer',
    format: 'int64',
    minimum: 0,
    example: 1792861200,
    description:
      'Vencimiento como Unix timestamp en segundos; multiplicar por 1000 para Date de JavaScript.',
  })
  expiresAt: number;
  @ApiProperty({ enum: ['bearer'], example: 'bearer' }) tokenType: string;
  @ApiProperty({
    type: AccessUserDto,
    description: 'Perfil y rol actuales de la aplicación.',
  })
  user: AccessUserDto;
}

export class MemberDto extends AccessUserDto {
  @ApiProperty({
    example: true,
    description: 'Estado del perfil en la aplicación.',
  })
  isActive: boolean;
  @ApiProperty({
    example: false,
    description:
      'false identifica un correo aún sin confirmar, incluido un usuario con invitación pendiente.',
  })
  emailConfirmed: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uuid',
    example: null,
    description:
      'Administrador que concedió el acceso. Puede ser null para el primer administrador.',
  })
  invitedBy: string | null;
}

export class MessageDto {
  @ApiProperty({
    example: 'Invitación enviada.',
    description: 'Mensaje informativo para mostrar al usuario.',
  })
  message: string;
}
