import { Pool } from 'pg';
import { AuthSessionRepository } from './auth-session.repository.js';

describe('AuthSessionRepository', () => {
  it('rotates a token using the deployed hash and revocation columns', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
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

    const updateSql = client.query.mock.calls[1]?.[0];
    expect(updateSql).toContain('token_hash');
    expect(updateSql).toContain('revoked_at');
    expect(updateSql).not.toContain('is_revoked');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO refresh_tokens'),
      ['user-id', 'new-hash', expect.any(Date)],
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
