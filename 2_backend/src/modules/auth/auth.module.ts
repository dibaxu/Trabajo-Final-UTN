import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { AuthController } from './auth.controller.js';
import { UsersController } from './users.controller.js';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { SupabaseAuthGateway } from './supabase-auth.gateway.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  imports: [
    DatabaseModule,
    SupabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    AuthRepository,
    SupabaseAuthGateway,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
