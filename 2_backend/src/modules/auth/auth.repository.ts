import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { Member } from './auth.types.js';

const memberSql = `SELECT p.id, u.email, p.display_name AS "displayName",
  r.code AS role, p.is_active AS "isActive", r.is_active AS "roleIsActive",
  (u.email_confirmed_at IS NOT NULL) AS "emailConfirmed", p.invited_by AS "invitedBy"
  FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
  JOIN auth.users u ON u.id = p.id`;

@Injectable()
export class AuthRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async findMember(id: string): Promise<Member | undefined> {
    const { rows } = await this.db.query<Member>(
      `${memberSql} WHERE p.id = $1`,
      [id],
    );
    return rows[0];
  }

  async isSessionActive(userId: string, sessionId: string): Promise<boolean> {
    const { rows } = await this.db.query<{ active: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM auth.sessions
       WHERE id = $1 AND user_id = $2 AND (not_after IS NULL OR not_after > now())) AS active`,
      [sessionId, userId],
    );
    return rows[0].active;
  }

  async findAccount(email: string): Promise<
    | {
        id: string;
        emailConfirmed: boolean;
        isActive: boolean | null;
      }
    | undefined
  > {
    const { rows } = await this.db.query<{
      id: string;
      emailConfirmed: boolean;
      isActive: boolean | null;
    }>(
      `SELECT u.id, (u.email_confirmed_at IS NOT NULL) AS "emailConfirmed",
        p.is_active AS "isActive" FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id WHERE lower(u.email) = $1`,
      [email],
    );
    return rows[0];
  }

  async provisionMember(
    id: string,
    displayName: string,
    invitedBy: string,
  ): Promise<void> {
    // Revalidar al actor también en la escritura; un reintento no reactiva ni cambia roles.
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO public.profiles (id, role_id, display_name, invited_by)
       SELECT $1, r.id, $2, $3 FROM public.roles r
       WHERE r.code = 'ADMINISTRADOR' AND r.is_active
         AND EXISTS (SELECT 1 FROM public.profiles actor
                     JOIN public.roles ar ON ar.id = actor.role_id
                     WHERE actor.id = $3 AND actor.is_active AND ar.is_active
                       AND ar.code = 'ADMINISTRADOR')
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [id, displayName, invitedBy],
    );
    if (!rows.length) {
      const actor = await this.findMember(invitedBy);
      const member = await this.findMember(id);
      if (
        !actor?.isActive ||
        !actor.roleIsActive ||
        actor.role !== 'ADMINISTRADOR' ||
        !member?.isActive
      ) {
        throw new ForbiddenException('No se pudo autorizar la invitación.');
      }
    }
  }

  async listMembers(): Promise<Member[]> {
    const { rows } = await this.db.query<Member>(
      `${memberSql} ORDER BY p.created_at, p.id`,
    );
    return rows;
  }

  async setStatus(
    actorId: string,
    userId: string,
    isActive: boolean,
  ): Promise<Member> {
    return this.db.transaction(async (client) => {
      // Serializa los cambios de acceso y evita que dos administradores se desactiven entre sí.
      await client.query('SELECT pg_advisory_xact_lock(1852797544)');
      const actor = (
        await client.query<Member>(`${memberSql} WHERE p.id = $1`, [actorId])
      ).rows[0];
      if (
        !actor?.isActive ||
        !actor.roleIsActive ||
        actor.role !== 'ADMINISTRADOR'
      ) {
        throw new ForbiddenException('Se requiere un administrador activo.');
      }
      if (actorId === userId && !isActive) {
        throw new ForbiddenException('No podés desactivar tu propio acceso.');
      }
      const result = await client.query(
        `UPDATE public.profiles SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING id`,
        [userId, isActive],
      );
      if (!result.rows.length)
        throw new NotFoundException('Usuario no encontrado.');
      return (
        await client.query<Member>(`${memberSql} WHERE p.id = $1`, [userId])
      ).rows[0];
    });
  }
}
