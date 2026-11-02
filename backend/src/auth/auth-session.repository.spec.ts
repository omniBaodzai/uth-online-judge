import { Pool } from 'pg';
import { AuthSessionRepository } from './auth-session.repository.js';

describe('AuthSessionRepository', () => {
  it('rotates a token using the deployed hash and revocation columns', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'user-id' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-id' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'user-id' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    };
    const repository = new AuthSessionRepository(pool as unknown as Pool);

    await expect(
      repository.rotate('old-hash', 'new-hash', new Date('2026-10-28T00:00:00.000Z')),
    ).resolves.toBe('user-id');

    const accountSql = client.query.mock.calls[2]?.[0];
    expect(accountSql).toContain('is_active = TRUE');
    expect(accountSql).toContain('FOR UPDATE');
    const revokeSql = client.query.mock.calls[3]?.[0];
    expect(revokeSql).toContain('token_hash');
    expect(revokeSql).toContain('revoked_at');
    expect(revokeSql).not.toContain('is_revoked');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO refresh_tokens'),
      ['user-id', 'new-hash', expect.any(Date)],
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('does not rotate a refresh token for an inactive account', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'inactive-user' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const repository = new AuthSessionRepository({
      connect: vi.fn().mockResolvedValue(client),
    } as never);

    await expect(
      repository.rotate('inactive-token-hash', 'next-token-hash', new Date()),
    ).resolves.toBeNull();

    expect(client.query.mock.calls[2]?.[0]).toContain('is_active = TRUE');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) =>
      String(sql).includes('INSERT INTO refresh_tokens'),
    )).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('revokes all active sessions except the current session', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 2 });
    const repository = new AuthSessionRepository({ query } as never);

    await repository.revokeAllExcept('user-id', 'current-token-hash');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('token_hash <> $2'),
      ['user-id', 'current-token-hash'],
    );
    expect(query.mock.calls[0]?.[0]).toContain('revoked_at IS NULL');
  });

  it('revokes all active sessions when there is no current refresh token', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 2 });
    const repository = new AuthSessionRepository({ query } as never);

    await repository.revokeAllExcept('user-id');

    expect(query).toHaveBeenCalledWith(expect.any(String), ['user-id', null]);
  });
});
