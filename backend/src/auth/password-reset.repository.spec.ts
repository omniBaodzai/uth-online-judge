import { PasswordResetRepository } from './password-reset.repository.js';

function createClient(queryResults: unknown[]) {
  const query = vi.fn(async () => queryResults.shift() ?? { rows: [] });
  return { query, release: vi.fn() };
}

describe('PasswordResetRepository', () => {
  it('serializes email and IP rate-limit counters and permits a request under both limits', async () => {
    const now = new Date();
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      {
        rows: [
          {
            scope: 'EMAIL',
            window_started_at: new Date(now.getTime() - 5 * 60_000),
            request_count: 2,
            last_requested_at: new Date(now.getTime() - 90_000),
            current_time: now,
          },
          {
            scope: 'IP',
            window_started_at: new Date(now.getTime() - 5 * 60_000),
            request_count: 4,
            last_requested_at: new Date(now.getTime() - 90_000),
            current_time: now,
          },
        ],
      },
      { rows: [] },
      { rows: [] },
    ]);
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.consumeRequestRateLimit('email-hash', 'ip-hash')).resolves.toBeNull();
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      ['email-hash', 'ip-hash'],
    );
    expect(client.query.mock.calls.at(-2)?.[0]).toContain('request_count + 1');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('returns a retry delay without consuming a request during the email cooldown', async () => {
    const now = new Date();
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      {
        rows: [
          {
            scope: 'EMAIL',
            window_started_at: new Date(now.getTime() - 10_000),
            request_count: 1,
            last_requested_at: new Date(now.getTime() - 30_000),
            current_time: now,
          },
          {
            scope: 'IP',
            window_started_at: new Date(now.getTime() - 10_000),
            request_count: 1,
            last_requested_at: new Date(now.getTime() - 30_000),
            current_time: now,
          },
        ],
      },
      { rows: [] },
    ]);
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.consumeRequestRateLimit('email-hash', 'ip-hash'))
      .resolves.toBeGreaterThanOrEqual(29);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('request_count + 1'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('counts wrong OTP guesses and consumes the OTP on the fifth attempt', async () => {
    const client = createClient([
      { rows: [] },
      {
        rows: [{
          id: 'challenge-id',
          user_id: 'user-id',
          otp_hash: 'expected-otp-hash',
          attempts: 4,
        }],
      },
      { rowCount: 1, rows: [] },
      { rows: [] },
    ]);
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.verifyOtp(
      'user@example.com',
      'email-hash',
      'wrong-hash',
      'reset-token-hash',
      new Date(),
    )).resolves.toBe(false);

    expect(client.query.mock.calls[1]?.[0]).toContain('attempts < 5');
    expect(client.query.mock.calls[1]?.[0]).toContain('expires_at > CURRENT_TIMESTAMP');
    expect(client.query.mock.calls[1]?.[0]).toContain('verified_at IS NULL');
    expect(client.query.mock.calls[1]?.[0]).toContain('challenge.purpose = $3');
    expect(client.query.mock.calls[1]?.[1]?.[2]).toBe('PASSWORD_RESET');
    expect(client.query.mock.calls[2]?.[0]).toContain('CASE WHEN $2 >= 5 THEN NULL');
    expect(client.query.mock.calls[2]?.[0]).toContain('consumed_at = CASE WHEN $2 >= 5');
    expect(client.query.mock.calls[2]?.[1]).toEqual([
      'challenge-id',
      5,
      'PASSWORD_RESET',
    ]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('marks a correct OTP used and stores only a reset-token hash', async () => {
    const client = createClient([
      { rows: [] },
      {
        rows: [{
          id: 'challenge-id',
          user_id: 'user-id',
          otp_hash: 'matching-otp-hash',
          attempts: 0,
        }],
      },
      { rowCount: 1, rows: [] },
      { rows: [] },
    ]);
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.verifyOtp(
      'user@example.com',
      'email-hash',
      'matching-otp-hash',
      'reset-token-hash',
      new Date(),
    )).resolves.toBe(true);

    expect(client.query.mock.calls[2]?.[0]).toContain('otp_hash = NULL');
    expect(client.query.mock.calls[2]?.[0]).toContain('reset_token_hash = $2');
    expect(client.query.mock.calls[2]?.[1]).toEqual([
      'challenge-id',
      'reset-token-hash',
      expect.any(Date),
      'PASSWORD_RESET',
    ]);
  });

  it('stores password setup OTPs under a purpose-scoped challenge and returns its transaction ID', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'setup-transaction-id' }],
    });
    const repository = new PasswordResetRepository({ query } as never);

    await expect(repository.storeOtp(
      'user-id',
      'email-hash',
      3,
      'otp-hash',
      new Date(),
      'PASSWORD_SETUP',
    )).resolves.toBe('setup-transaction-id');

    expect(query.mock.calls[0]?.[0]).toContain('ON CONFLICT (purpose, email_hash)');
    expect(query.mock.calls[0]?.[0]).toContain('RETURNING id');
    expect(query.mock.calls[0]?.[0]).toContain('attempts = 0');
    expect(query.mock.calls[0]?.[0]).toContain('reset_token_hash = NULL');
    expect(query.mock.calls[0]?.[1]?.[5]).toBe('PASSWORD_SETUP');
  });

  it('only finds active OAuth-linked accounts that have not set a password', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'user-id', email: 'oauth@example.com', auth_version: 0 }],
    });
    const repository = new PasswordResetRepository({ query } as never);

    await expect(repository.findPasswordSetupAccount('user-id'))
      .resolves.toMatchObject({ id: 'user-id', email: 'oauth@example.com' });

    expect(query.mock.calls[0]?.[0]).toContain('is_active = TRUE');
    expect(query.mock.calls[0]?.[0]).toContain('password_hash IS NULL');
    expect(query.mock.calls[0]?.[0]).toContain('(google_id IS NOT NULL OR github_id IS NOT NULL)');
    expect(query.mock.calls[0]?.[1]).toEqual(['user-id']);
  });

  it('requires password setup OTP verification to match purpose, user, and transaction', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.verifyOtp(
      'user@example.com',
      'email-hash',
      'otp-hash',
      'setup-token-hash',
      new Date(),
      'PASSWORD_SETUP',
      'user-id',
      'transaction-id',
    )).resolves.toBe(false);

    expect(client.query.mock.calls[1]?.[0]).toContain('challenge.purpose = $3');
    expect(client.query.mock.calls[1]?.[0]).toContain('challenge.user_id = $4');
    expect(client.query.mock.calls[1]?.[0]).toContain('challenge.id = $5');
    expect(client.query.mock.calls[1]?.[1]).toEqual([
      'email-hash',
      'user@example.com',
      'PASSWORD_SETUP',
      'user-id',
      'transaction-id',
    ]);
    expect(client.query.mock.calls[1]?.[0]).toContain('account.password_hash IS NULL');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('updates password, consumes reset token, and revokes refresh sessions atomically', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [{ id: 'challenge-id', user_id: 'user-id' }] },
      { rowCount: 1, rows: [] },
      { rowCount: 1, rows: [] },
      { rowCount: 2, rows: [] },
      { rows: [] },
    ]);
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.consumeResetToken('token-hash', 'password-hash')).resolves.toBe(true);

    expect(client.query.mock.calls[1]?.[0]).toContain('FOR UPDATE OF challenge, account');
    expect(client.query.mock.calls[1]?.[0]).toContain("challenge.purpose = 'PASSWORD_RESET'");
    expect(client.query.mock.calls[2]?.[0]).toContain('auth_version = auth_version + 1');
    expect(client.query.mock.calls[3]?.[0]).toContain('consumed_at = CURRENT_TIMESTAMP');
    expect(client.query.mock.calls[4]?.[0]).toContain('UPDATE public.refresh_tokens');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('completes password setup atomically and preserves only the current refresh session', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [{ id: 'challenge-id', user_id: 'user-id', auth_version: 3 }] },
      { rowCount: 1, rows: [{ auth_version: 4 }] },
      { rowCount: 1, rows: [] },
      { rowCount: 2, rows: [] },
      { rows: [] },
    ]);
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.completePasswordSetup(
      'user-id',
      'user@example.com',
      'email-hash',
      'setup-token-hash',
      'new-password-hash',
      'current-refresh-hash',
    )).resolves.toBe(4);

    const challengeSql = String(client.query.mock.calls[1]?.[0]);
    expect(challengeSql).toContain("challenge.purpose = 'PASSWORD_SETUP'");
    expect(challengeSql).toContain('challenge.auth_version = account.auth_version');
    expect(challengeSql).toContain('account.password_hash IS NULL');
    expect(challengeSql).toContain('FOR UPDATE OF challenge, account');
    expect(client.query.mock.calls[2]?.[0]).toContain('auth_version = auth_version + 1');
    expect(client.query.mock.calls[3]?.[0]).toContain("purpose = 'PASSWORD_SETUP'");
    expect(client.query.mock.calls[4]?.[0]).toContain('token_hash <> $2');
    expect(client.query.mock.calls[4]?.[1]).toEqual([
      'user-id',
      'current-refresh-hash',
    ]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('does not update password or sessions when a setup token is missing, expired, or replayed', async () => {
    const client = createClient([{ rows: [] }, { rows: [] }, { rows: [] }]);
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.completePasswordSetup(
      'user-id',
      'user@example.com',
      'email-hash',
      'used-token-hash',
      'new-password-hash',
      'current-refresh-hash',
    )).resolves.toBeNull();

    expect(client.query.mock.calls[1]?.[0]).toContain('reset_token_expires_at > CURRENT_TIMESTAMP');
    expect(client.query.mock.calls[1]?.[0]).toContain('consumed_at IS NULL');
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes('UPDATE public.users'),
    )).toBe(false);
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes('UPDATE public.refresh_tokens'),
    )).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rolls back the password update when a later transactional operation fails', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'challenge-id', user_id: 'user-id' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockRejectedValueOnce(new Error('challenge update failed'))
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.consumeResetToken('token-hash', 'password-hash'))
      .rejects.toThrow('challenge update failed');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects expired or already consumed reset tokens without changing password data', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);
    const repository = new PasswordResetRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(repository.consumeResetToken('expired-or-used-token', 'password-hash'))
      .resolves.toBe(false);

    expect(client.query.mock.calls[1]?.[0]).toContain('reset_token_expires_at > CURRENT_TIMESTAMP');
    expect(client.query.mock.calls[1]?.[0]).toContain('consumed_at IS NULL');
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE public.users'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
