import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { ActivityLogService } from '../platform/activity-log.service.js';
import { USER_ROLES, type UserRole } from '../platform/roles.guard.js';

export function pageParams(page?: string, pageSize?: string, maxSize = 100) {
  const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const size = Math.min(maxSize, Math.max(1, Number.parseInt(pageSize ?? '20', 10) || 20));
  return { page: p, pageSize: size, offset: (p - 1) * size };
}

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(DATABASE_POOL) private readonly database: Pool,
    private readonly activity: ActivityLogService,
  ) {}

  async list(query: { search?: string; role?: string; status?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, offset } = pageParams(query.page, query.pageSize);
    const where: string[] = [];
    const values: unknown[] = [];
    if (query.search?.trim()) {
      values.push(`%${escapeLike(query.search.trim())}%`);
      where.push(`(u.username ILIKE $${values.length} OR u.email ILIKE $${values.length} OR u.full_name ILIKE $${values.length})`);
    }
    if (query.role && USER_ROLES.includes(query.role as UserRole)) {
      values.push(query.role);
      where.push(`u.role = $${values.length}`);
    }
    if (query.status === 'active') where.push('u.is_active = TRUE');
    if (query.status === 'locked') where.push('u.is_active = FALSE');
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = await this.database.query<{ count: string }>(`SELECT count(*) FROM users u ${clause}`, values);
    const rows = await this.database.query(
      `SELECT u.id, u.username, u.email, u.full_name AS "fullName", u.role, u.is_active AS "isActive",
              u.created_at AS "createdAt",
              (SELECT count(*)::int FROM submissions s WHERE s.user_id = u.id) AS "submissionCount",
              (SELECT max(a.created_at) FROM activity_logs a WHERE a.user_id = u.id AND a.action = 'LOGIN') AS "lastLoginAt"
       FROM users u ${clause}
       ORDER BY u.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, offset],
    );
    return { items: rows.rows, total: Number(total.rows[0]?.count ?? 0), page, pageSize };
  }

  async changeRole(actorId: string, id: string, role: UserRole) {
    if (actorId === id) throw new BadRequestException('Bạn không thể tự đổi vai trò của chính mình.');
    const target = await this.requireUser(id);
    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      const admins = await this.database.query<{ count: string }>(
        "SELECT count(*) FROM users WHERE role = 'ADMIN' AND is_active = TRUE",
      );
      if (Number(admins.rows[0]?.count) <= 1) throw new ConflictException('Phải còn ít nhất một quản trị viên hoạt động.');
    }
    await this.database.query('UPDATE users SET role = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id, role]);
    await this.activity.log({ userId: id, actorId, action: 'ROLE_CHANGED', detail: { from: target.role, to: role } });
    return { id, role };
  }

  async setStatus(actorId: string, id: string, isActive: boolean) {
    if (actorId === id) throw new BadRequestException('Bạn không thể tự khóa tài khoản của chính mình.');
    const target = await this.requireUser(id);
    if (!isActive && target.role === 'ADMIN') {
      const admins = await this.database.query<{ count: string }>(
        "SELECT count(*) FROM users WHERE role = 'ADMIN' AND is_active = TRUE",
      );
      if (Number(admins.rows[0]?.count) <= 1) throw new ConflictException('Phải còn ít nhất một quản trị viên hoạt động.');
    }
    await this.database.query('UPDATE users SET is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id, isActive]);
    if (!isActive) await this.revokeSessions(id);
    await this.activity.log({ userId: id, actorId, action: isActive ? 'ACCOUNT_UNLOCKED' : 'ACCOUNT_LOCKED' });
    return { id, isActive };
  }

  /** Tạo mật khẩu tạm ngẫu nhiên, trả về đúng một lần; đồng thời thu hồi mọi phiên đăng nhập cũ. */
  async resetPassword(actorId: string, id: string) {
    await this.requireUser(id);
    const temporaryPassword = `${randomBytes(9).toString('base64url')}#1a`;
    const hash = await bcrypt.hash(temporaryPassword, 12);
    await this.database.query('UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id, hash]);
    await this.revokeSessions(id);
    await this.activity.log({ userId: id, actorId, action: 'PASSWORD_RESET' });
    return { id, temporaryPassword };
  }

  async activityOf(id: string, page?: string, pageSize?: string) {
    await this.requireUser(id);
    const p = pageParams(page, pageSize, 100);
    const rows = await this.database.query(
      `SELECT a.id, a.action, a.detail, a.ip, a.created_at AS "createdAt",
              actor.username AS "actorUsername"
       FROM activity_logs a LEFT JOIN users actor ON actor.id = a.actor_id
       WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
      [id, p.pageSize, p.offset],
    );
    const total = await this.database.query<{ count: string }>('SELECT count(*) FROM activity_logs WHERE user_id = $1', [id]);
    return { items: rows.rows, total: Number(total.rows[0]?.count ?? 0), page: p.page, pageSize: p.pageSize };
  }

  private async revokeSessions(id: string) {
    await this.database.query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL', [id]);
  }

  private async requireUser(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Không tìm thấy người dùng.');
    const result = await this.database.query<{ id: string; role: UserRole }>('SELECT id, role FROM users WHERE id = $1', [id]);
    if (!result.rows[0]) throw new NotFoundException('Không tìm thấy người dùng.');
    return result.rows[0];
  }
}
