import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Administración de emprendimiento de impresión 3D')
    .setDescription(
      'Contrato de la API del proyecto final UTN. Todas las rutas llevan el prefijo /api. ' +
        'Las operaciones de acceso son públicas cuando así se indica; las demás requieren un accessToken Bearer y un perfil activo. ' +
        'El acceso es por invitación y el MVP asigna ADMINISTRADOR a los miembros. ' +
        'Los cuerpos rechazan propiedades desconocidas. Los ejemplos contienen valores ficticios. ' +
        'Solo se enumeran endpoints implementados; los módulos de productos, ventas y reportes se incorporarán de forma incremental.',
    )
    .setVersion('0.1.0')
    .setOpenAPIVersion('3.0.3')
    .addServer('/', 'Mismo origen que el servidor de la API')
    .addTag('Auth', 'Ingreso, sesiones, perfil y recuperación del acceso.')
    .addTag(
      'Users',
      'Invitaciones y administración de miembros. Requiere ADMINISTRADOR activo.',
    )
    .addTag('Health', 'Disponibilidad de la API y PostgreSQL; acceso público.')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Access token devuelto por login, verify, refresh o password. En Authorize pegar solo el token, sin el prefijo Bearer.',
    })
    .build();

  return SwaggerModule.createDocument(app, config, {
    autoTagControllers: false,
  });
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup('api/docs', app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    customSiteTitle: 'API UTN · Documentación',
    swaggerOptions: {
      displayOperationId: true,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      persistAuthorization: false,
      validatorUrl: null,
    },
  });
}
