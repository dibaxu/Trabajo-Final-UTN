import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({
    type: 'integer',
    example: 401,
    description: 'Código de estado HTTP.',
  })
  statusCode: number;

  @ApiProperty({
    description:
      'Descripción del error; las validaciones pueden devolver una lista de mensajes. No usar el texto como código de negocio.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Se requiere una sesión válida.',
  })
  message: string | string[];

  @ApiPropertyOptional({
    example: 'Unauthorized',
    description: 'Nombre del error cuando Nest lo incluye en la respuesta.',
  })
  error?: string;
}

const errors = {
  400: {
    description:
      'Cuerpo o parámetro inválido; también se rechazan propiedades desconocidas.',
    example: {
      statusCode: 400,
      message: ['email must be an email'],
      error: 'Bad Request',
    },
  },
  401: {
    description:
      'Credenciales, enlace o token inválidos, vencidos o revocados.',
    example: {
      statusCode: 401,
      message: 'Se requiere una sesión válida.',
      error: 'Unauthorized',
    },
  },
  403: {
    description:
      'Perfil o rol sin acceso activo, permiso insuficiente o acción no permitida.',
    example: {
      statusCode: 403,
      message: 'No tenés acceso activo a esta aplicación.',
      error: 'Forbidden',
    },
  },
  404: {
    description: 'El usuario indicado no existe.',
    example: {
      statusCode: 404,
      message: 'Usuario no encontrado.',
      error: 'Not Found',
    },
  },
  409: {
    description:
      'La cuenta ya existe o ya confirmó su correo; usar login o recuperación.',
    example: {
      statusCode: 409,
      message: 'La cuenta ya confirmó su correo.',
      error: 'Conflict',
    },
  },
  429: {
    description:
      'Se alcanzó el límite de intentos de la API o del proveedor. Esperar antes de reintentar.',
    example: {
      statusCode: 429,
      message: 'ThrottlerException: Too Many Requests',
    },
  },
  500: {
    description:
      'Error interno; la respuesta no incluye detalles de infraestructura.',
    example: { statusCode: 500, message: 'Internal server error' },
  },
  503: {
    description:
      'El servicio de autenticación o el envío de correo no están disponibles.',
    example: {
      statusCode: 503,
      message: 'El servicio de autenticación no está disponible.',
      error: 'Service Unavailable',
    },
  },
} as const;

/** Comparte el formato HTTP de errores; no modifica excepciones ni reglas de acceso. */
export function ApiErrors(...statuses: (keyof typeof errors)[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        type: ApiErrorDto,
        description: errors[status].description,
        example: errors[status].example,
      }),
    ),
  );
}
