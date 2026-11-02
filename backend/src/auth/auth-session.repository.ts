import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

type RefreshSession = {
  user_id: string;
};

@Injectable()
export class AuthSessionRepository {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly database: Pool,
  ) {}

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.database.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async rotate(
    currentTokenHash: string,
    nextTokenHash: string,
    expiresAt: Date,
  ): Promise<string | null> {
    const client = await this.database.connect();

    try {
      await client.query('BEGIN');
      const eligible = await client.query<RefreshSession>(
        `SELECT token.user_id
         FROM refresh_tokens token
         WHERE token.token_hash = $1
           AND token.revoked_at IS NULL
           AND token.expires_at > CURRENT_TIMESTAMP`,
        [currentTokenHash],
      );
      const session = eligible.rows[0];

      if (!session) {
        await client.query('ROLLBACK');
        return null;
      }

      const activeAccount = await client.query<{ id: string }>(
        `SELECT id
         FROM users
         WHERE id = $1
           AND is_active = TRUE
         FOR UPDATE`,
        [session.user_id],
      );
      if (!activeAccount.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      const revoked = await client.query<RefreshSession>(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE token_hash = $1
           AND revoked_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
         RETURNING user_id`,
        [currentTokenHash],
      );
      if (!revoked.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [revoked.rows[0].user_id, nextTokenHash, expiresAt],
      );
      await client.query('COMMIT');
      return revoked.rows[0].user_id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.database.query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE token_hash = $1
         AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  async revokeAllExcept(userId: string, currentTokenHash?: string): Promise<void> {
    await this.database.query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND ($2::text IS NULL OR token_hash <> $2)`,
      [userId, currentTokenHash ?? null],
    );
  }
}
