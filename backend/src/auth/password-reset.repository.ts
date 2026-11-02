import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

type RateLimitRow = {
  scope: 'EMAIL' | 'IP';
  window_started_at: Date;
  request_count: number;
  last_requested_at: Date;
  current_time: Date;
};

const RATE_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_COOLDOWN_MS = 60 * 1000;
const EMAIL_LIMIT = 5;
const IP_LIMIT = 20;

@Injectable()
export class PasswordResetRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async consumeRequestRateLimit(emailHash: string, ipHash: string): Promise<number | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM public.password_reset_rate_limits
         WHERE last_requested_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
      );
      await client.query(
        `INSERT INTO public.password_reset_rate_limits
           (scope, key_hash, window_started_at, request_count, last_requested_at)
         VALUES
           ('EMAIL', $1, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
           ('IP', $2, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP - INTERVAL '1 hour')
         ON CONFLICT (scope, key_hash) DO NOTHING`,
        [emailHash, ipHash],
      );
      const result = await client.query<RateLimitRow>(
        `SELECT scope, window_started_at, request_count, last_requested_at,
                CURRENT_TIMESTAMP AS current_time
         FROM public.password_reset_rate_limits
         WHERE (scope = 'EMAIL' AND key_hash = $1)
            OR (scope = 'IP' AND key_hash = $2)
         ORDER BY scope, key_hash
         FOR UPDATE`,
        [emailHash, ipHash],
      );
      const email = result.rows.find((row) => row.scope === 'EMAIL');
      const ip = result.rows.find((row) => row.scope === 'IP');
      if (!email || !ip) throw new Error('Password reset rate-limit rows were not created.');

      const now = email.current_time.getTime();
      const emailWindowExpired = now - email.window_started_at.getTime() >= RATE_WINDOW_MS;
      const ipWindowExpired = now - ip.window_started_at.getTime() >= RATE_WINDOW_MS;
      const retryAfter = [
        email.last_requested_at.getTime() + EMAIL_COOLDOWN_MS > now
          ? email.last_requested_at.getTime() + EMAIL_COOLDOWN_MS
          : 0,
        !emailWindowExpired && Number(email.request_count) >= EMAIL_LIMIT
          ? email.window_started_at.getTime() + RATE_WINDOW_MS
          : 0,
        !ipWindowExpired && Number(ip.request_count) >= IP_LIMIT
          ? ip.window_started_at.getTime() + RATE_WINDOW_MS
          : 0,
      ].reduce((latest, value) => Math.max(latest, value), 0);

      if (retryAfter > now) {
        await client.query('COMMIT');
        return Math.max(1, Math.ceil((retryAfter - now) / 1000));
      }

      await client.query(
        `UPDATE public.password_reset_rate_limits
         SET window_started_at = CASE
               WHEN window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 hour'
               THEN CURRENT_TIMESTAMP ELSE window_started_at END,
             request_count = CASE
               WHEN window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 hour'
               THEN 1 ELSE request_count + 1 END,
             last_requested_at = CURRENT_TIMESTAMP
         WHERE (scope = 'EMAIL' AND key_hash = $1)
            OR (scope = 'IP' AND key_hash = $2)`,
        [emailHash, ipHash],
      );
      await client.query('COMMIT');
      return null;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async findEligibleAccount(email: string): Promise<{ id: string; email: string; auth_version: number } | null> {
    const result = await this.pool.query<{ id: string; email: string; auth_version: number }>(
      `SELECT id, email, auth_version
       FROM public.users
       WHERE lower(email) = $1
         AND is_active = TRUE
         AND password_hash IS NOT NULL
       LIMIT 1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async storeOtp(
    userId: string,
    emailHash: string,
    authVersion: number,
    otpHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.password_reset_challenges
         (user_id, email_hash, auth_version, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email_hash) DO UPDATE
       SET user_id = EXCLUDED.user_id,
       auth_version = EXCLUDED.auth_version,
           otp_hash = EXCLUDED.otp_hash,
           expires_at = EXCLUDED.expires_at,
           attempts = 0,
           verified_at = NULL,
           reset_token_hash = NULL,
           reset_token_expires_at = NULL,
           consumed_at = NULL,
           created_at = CURRENT_TIMESTAMP`,
      [userId, emailHash, authVersion, otpHash, expiresAt],
    );
  }

  async verifyOtp(
    email: string,
    emailHash: string,
    otpHash: string,
    resetTokenHash: string,
    resetTokenExpiresAt: Date,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{
        id: string;
        user_id: string;
        otp_hash: string;
        attempts: number;
      }>(
        `SELECT challenge.id, challenge.user_id, challenge.otp_hash, challenge.attempts
         FROM public.password_reset_challenges challenge
         JOIN public.users account ON account.id = challenge.user_id
         WHERE challenge.email_hash = $1
           AND lower(account.email) = $2
           AND account.is_active = TRUE
           AND challenge.auth_version = account.auth_version
           AND challenge.otp_hash IS NOT NULL
           AND challenge.consumed_at IS NULL
           AND challenge.verified_at IS NULL
           AND challenge.expires_at > CURRENT_TIMESTAMP
           AND challenge.attempts < 5
         FOR UPDATE OF challenge`,
        [emailHash, email],
      );
      const challenge = result.rows[0];
      if (!challenge) {
        await client.query('ROLLBACK');
        return false;
      }

      if (challenge.otp_hash !== otpHash) {
        const attempts = Number(challenge.attempts) + 1;
        await client.query(
          `UPDATE public.password_reset_challenges
           SET attempts = $2,
               otp_hash = CASE WHEN $2 >= 5 THEN NULL ELSE otp_hash END,
               consumed_at = CASE WHEN $2 >= 5 THEN CURRENT_TIMESTAMP ELSE consumed_at END
           WHERE id = $1`,
          [challenge.id, attempts],
        );
        await client.query('COMMIT');
        return false;
      }

      const updated = await client.query(
        `UPDATE public.password_reset_challenges
         SET otp_hash = NULL,
             verified_at = CURRENT_TIMESTAMP,
             reset_token_hash = $2,
             reset_token_expires_at = $3
         WHERE id = $1
           AND consumed_at IS NULL
           AND verified_at IS NULL`,
        [challenge.id, resetTokenHash, resetTokenExpiresAt],
      );
      if (updated.rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async consumeResetToken(resetTokenHash: string, passwordHash: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ id: string; user_id: string }>(
        `SELECT challenge.id, challenge.user_id
         FROM public.password_reset_challenges challenge
         JOIN public.users account ON account.id = challenge.user_id
         WHERE challenge.reset_token_hash = $1
           AND challenge.reset_token_expires_at > CURRENT_TIMESTAMP
           AND challenge.consumed_at IS NULL
           AND account.is_active = TRUE
           AND challenge.auth_version = account.auth_version
         FOR UPDATE OF challenge, account`,
        [resetTokenHash],
      );
      const challenge = result.rows[0];
      if (!challenge) {
        await client.query('ROLLBACK');
        return false;
      }

      const updated = await client.query(
        `UPDATE public.users
         SET password_hash = $2,
             auth_version = auth_version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND is_active = TRUE`,
        [challenge.user_id, passwordHash],
      );
      if (updated.rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }
      const consumed = await client.query(
        `UPDATE public.password_reset_challenges
         SET reset_token_hash = NULL,
             reset_token_expires_at = NULL,
             consumed_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND reset_token_hash = $2 AND consumed_at IS NULL`,
        [challenge.id, resetTokenHash],
      );
      if (consumed.rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(
        `UPDATE public.refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [challenge.user_id],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function rollback(client: PoolClient): Promise<void> {
  await client.query('ROLLBACK');
}
