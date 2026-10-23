import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import type {
  AdminUser,
  AdminUserAuthMethod,
  AdminUserChange,
  AdminUserListQuery,
  AdminUserPage,
  AdminUserRole,
} from './admin-users.types.js';

type UserRow = {
  id: string;
  username: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AdminUserRole;
  is_active: boolean;
  has_password: boolean;
  has_google: boolean;
  has_github: boolean;
  created_at: Date;
  updated_at: Date;
};

// Cố ý không chọn password_hash, google_id, github_id; chỉ lấy cờ boolean.
const USER_FIELDS = `
  u.id, u.username, u.email, u.full_name, u.avatar_url, u.role, u.is_active,
  u.password_hash IS NOT NULL AS has_password,
  u.google_id IS NOT NULL AS has_google,
  u.github_id IS NOT NULL AS has_github,
  u.created_at, u.updated_at`;

@Injectable()
export class AdminUsersRepository {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async listUsers(query: AdminUserListQuery): Promise<AdminUserPage> {
    const conditions: string[] = [];
    const values: Array<string | number | boolean> = [];
    if (query.search) {
      values.push(`%${escapeLike(query.search)}%`);
      const param = `$${values.length}`;
      conditions.push(
        `(u.username ILIKE ${param} ESCAPE '\\' OR u.email ILIKE ${param} ESCAPE '\\' OR u.full_name ILIKE ${param} ESCAPE '\\')`,
      );
    }
    if (query.role) {
      values.push(query.role);
      conditions.push(`u.role = $${values.length}`);
    }
    if (query.status) {
      values.push(query.status === 'active');
      conditions.push(`u.is_active = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.database.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM users u ${where}`,
      values,
    );
    const pageValues = [...values, query.pageSize, (query.page - 1) * query.pageSize];
    const rows = await this.database.query<UserRow>(
      `SELECT ${USER_FIELDS}
       FROM users u
       ${where}
       ORDER BY u.created_at DESC, u.id ASC
       LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    );
    return {
      items: rows.rows.map(mapUser),
      total: Number(count.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findUser(id: string): Promise<AdminUser> {
    const result = await this.database.query<UserRow>(
      `SELECT ${USER_FIELDS} FROM users u WHERE u.id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy người dùng.');
    return mapUser(row);
  }

  /**
   * Đổi vai trò hoặc trạng thái trong một transaction. Các Admin đang hoạt động
   * được khóa theo thứ tự id để hai yêu cầu song song không thể cùng gỡ Admin cuối cùng.
   */
  async applyChange(targetId: string, actorId: string, change: AdminUserChange): Promise<AdminUser> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const admins = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE ORDER BY id FOR UPDATE`,
      );
      const target = await client.query<{ id: string; role: AdminUserRole; is_active: boolean }>(
        `SELECT id, role, is_active FROM users WHERE id = $1 FOR UPDATE`,
        [targetId],
      );
      const current = target.rows[0];
      if (!current) throw new NotFoundException('Không tìm thấy người dùng.');

      const nextRole = 'role' in change ? change.role : current.role;
      const nextActive = 'isActive' in change ? change.isActive : current.is_active;
      const losesAdminAccess =
        current.role === 'ADMIN' && current.is_active && (nextRole !== 'ADMIN' || !nextActive);

      if (losesAdminAccess) {
        if (current.id === actorId) {
          throw new BadRequestException(
            'role' in change
              ? 'Bạn không thể tự gỡ quyền Admin của chính mình.'
              : 'Bạn không thể tự vô hiệu hóa tài khoản của chính mình.',
          );
        }
        if (admins.rows.length <= 1) {
          throw new ConflictException('Không thể gỡ quyền hoặc vô hiệu hóa Admin đang hoạt động cuối cùng.');
        }
      }

      if (nextRole !== current.role || nextActive !== current.is_active) {
        await client.query(
          `UPDATE users SET role = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [targetId, nextRole, nextActive],
        );
        if (!nextActive) {
          await client.query(
            `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`,
            [targetId],
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.findUser(targetId);
  }
}

function mapUser(row: UserRow): AdminUser {
  const authMethods: AdminUserAuthMethod[] = [];
  if (row.has_password) authMethods.push('password');
  if (row.has_google) authMethods.push('google');
  if (row.has_github) authMethods.push('github');
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    isActive: row.is_active,
    authMethods,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
