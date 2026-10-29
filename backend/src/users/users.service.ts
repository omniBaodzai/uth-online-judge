import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export type UserRecord = {
  id: string;
  username: string | null;
  email: string;
  password_hash: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  role: 'STUDENT' | 'ADMIN';
  created_at: Date;
  updated_at: Date;
};

export type PublicUser = Omit<UserRecord, 'password_hash'>;

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly database: Pool,
  ) {}

  async findByIdentifier(identifier: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRecord>(
      `SELECT id, username, email, password_hash, full_name, avatar_url,
              is_active, role, created_at, updated_at
       FROM users
       WHERE lower(email) = $1 OR lower(username) = $1
       LIMIT 1`,
      [identifier],
    );

    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<PublicUser | null> {
    const result = await this.database.query<PublicUser>(
      `SELECT id, username, email, full_name, avatar_url,
              is_active, role, created_at, updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async create(input: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<PublicUser> {
    const result = await this.database.query<PublicUser>(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, full_name, avatar_url,
                 is_active, role, created_at, updated_at`,
      [input.username, input.email, input.passwordHash],
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error('User insert did not return a row');
    }

    return user;
  }

  async updateProfile(
    id: string,
    input: { fullName?: string | null; avatarUrl?: string | null },
  ): Promise<PublicUser | null> {
    const updateFullName = Object.hasOwn(input, 'fullName');
    const updateAvatarUrl = Object.hasOwn(input, 'avatarUrl');
    const result = await this.database.query<PublicUser>(
      `UPDATE users
       SET full_name = CASE WHEN $2 THEN $3 ELSE full_name END,
           avatar_url = CASE WHEN $4 THEN $5 ELSE avatar_url END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, username, email, full_name, avatar_url,
                 is_active, role, created_at, updated_at`,
      [
        id,
        updateFullName,
        updateFullName ? input.fullName?.trim() || null : null,
        updateAvatarUrl,
        updateAvatarUrl ? input.avatarUrl?.trim() || null : null,
      ],
    );

    return result.rows[0] ?? null;
  }
}
