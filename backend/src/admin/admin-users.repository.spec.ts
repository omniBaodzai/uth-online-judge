import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminUsersRepository } from './admin-users.repository.js';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OTHER,
    username: 'student1',
    email: 'student1@uth.edu.vn',
    full_name: 'Sinh Viên',
    avatar_url: null,
    role: 'STUDENT',
    is_active: true,
    has_password: true,
    has_google: false,
    has_github: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

type Target = { id: string; role: 'STUDENT' | 'ADMIN'; is_active: boolean } | null;

function setup(target: Target, activeAdmins: string[]) {
  const statements: Array<[string, unknown[] | undefined]> = [];
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      statements.push([sql, values]);
      if (sql.includes(`role = 'ADMIN' AND is_active = TRUE`)) {
        return { rows: activeAdmins.map((id) => ({ id })), rowCount: activeAdmins.length };
      }
      if (sql.includes('FROM users WHERE id = $1 FOR UPDATE')) {
        return { rows: target ? [target] : [], rowCount: target ? 1 : 0 };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const database = {
    query: vi.fn().mockResolvedValue({ rows: [userRow()], rowCount: 1 }),
    connect: vi.fn().mockResolvedValue(client),
  };
  return { repository: new AdminUsersRepository(database as never), client, statements };
}

const wrote = (statements: Array<[string, unknown[] | undefined]>) =>
  statements.some(([sql]) => sql.includes('UPDATE users'));
const ended = (statements: Array<[string, unknown[] | undefined]>, command: string) =>
  statements.some(([sql]) => sql === command);

describe('AdminUsersRepository.listUsers', () => {
  it('binds search, role and status filters and never selects credential columns', async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [userRow()] }),
    };
    const repository = new AdminUsersRepository(database as never);
    const hostile = "x%'; DROP TABLE users; --";

    const result = await repository.listUsers({
      page: 2,
      pageSize: 10,
      search: hostile,
      role: 'STUDENT',
      status: 'inactive',
    });

    const [countSql, countValues] = database.query.mock.calls[0] as [string, unknown[]];
    expect(countSql).not.toContain('DROP TABLE');
    expect(countValues).toEqual([`%x\\%'; DROP TABLE users; --%`, 'STUDENT', false]);
    const [listSql, listValues] = database.query.mock.calls[1] as [string, unknown[]];
    expect(listValues).toEqual([...countValues, 10, 10]);
    expect(listSql).not.toMatch(/SELECT[^;]*u\.(password_hash|google_id|github_id)\b(?! IS NOT NULL)/);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: OTHER,
      fullName: 'Sinh Viên',
      role: 'STUDENT',
      isActive: true,
      authMethods: ['password', 'github'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toMatch(/password_hash|passwordHash|token/i);
  });

  it('omits the WHERE clause when no filter is supplied', async () => {
    const database = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    await new AdminUsersRepository(database as never).listUsers({ page: 1, pageSize: 20 });
    expect(database.query.mock.calls[0]?.[0]).not.toContain('WHERE');
  });
});

describe('AdminUsersRepository.findUser', () => {
  it('throws NotFound for an unknown user', async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await expect(new AdminUsersRepository(database as never).findUser(OTHER))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminUsersRepository.applyChange', () => {
  it('promotes a student to admin inside a committed transaction', async () => {
    const { repository, statements, client } = setup(
      { id: OTHER, role: 'STUDENT', is_active: true },
      [ACTOR],
    );
    await repository.applyChange(OTHER, ACTOR, { role: 'ADMIN' });
    const update = statements.find(([sql]) => sql.includes('UPDATE users'));
    expect(update?.[1]).toEqual([OTHER, 'ADMIN', true]);
    expect(ended(statements, 'COMMIT')).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('demotes another admin when more than one active admin exists', async () => {
    const { repository, statements } = setup(
      { id: OTHER, role: 'ADMIN', is_active: true },
      [ACTOR, OTHER],
    );
    await repository.applyChange(OTHER, ACTOR, { role: 'STUDENT' });
    expect(statements.find(([sql]) => sql.includes('UPDATE users'))?.[1]).toEqual([OTHER, 'STUDENT', true]);
  });

  it('rejects self-demotion and self-deactivation without writing', async () => {
    for (const change of [{ role: 'STUDENT' as const }, { isActive: false }]) {
      const { repository, statements } = setup(
        { id: ACTOR, role: 'ADMIN', is_active: true },
        [ACTOR, OTHER],
      );
      await expect(repository.applyChange(ACTOR, ACTOR, change)).rejects.toBeInstanceOf(BadRequestException);
      expect(wrote(statements)).toBe(false);
      expect(ended(statements, 'ROLLBACK')).toBe(true);
    }
  });

  it('protects the last active admin from demotion and deactivation', async () => {
    for (const change of [{ role: 'STUDENT' as const }, { isActive: false }]) {
      const { repository, statements } = setup(
        { id: OTHER, role: 'ADMIN', is_active: true },
        [OTHER],
      );
      await expect(repository.applyChange(OTHER, ACTOR, change)).rejects.toBeInstanceOf(ConflictException);
      expect(wrote(statements)).toBe(false);
    }
  });

  it('revokes refresh tokens when deactivating an account', async () => {
    const { repository, statements } = setup(
      { id: OTHER, role: 'STUDENT', is_active: true },
      [ACTOR],
    );
    await repository.applyChange(OTHER, ACTOR, { isActive: false });
    expect(statements.some(([sql, values]) => sql.includes('UPDATE refresh_tokens') && values?.[0] === OTHER)).toBe(true);
  });

  it('does not revoke tokens when reactivating an account', async () => {
    const { repository, statements } = setup(
      { id: OTHER, role: 'STUDENT', is_active: false },
      [ACTOR],
    );
    await repository.applyChange(OTHER, ACTOR, { isActive: true });
    expect(statements.some(([sql]) => sql.includes('UPDATE refresh_tokens'))).toBe(false);
  });

  it('is a no-op when the user already has the requested state', async () => {
    const { repository, statements } = setup(
      { id: OTHER, role: 'STUDENT', is_active: true },
      [ACTOR],
    );
    await repository.applyChange(OTHER, ACTOR, { role: 'STUDENT' });
    expect(wrote(statements)).toBe(false);
    expect(ended(statements, 'COMMIT')).toBe(true);
  });

  it('throws NotFound and rolls back for a missing target', async () => {
    const { repository, statements, client } = setup(null, [ACTOR]);
    await expect(repository.applyChange(OTHER, ACTOR, { role: 'ADMIN' })).rejects.toBeInstanceOf(NotFoundException);
    expect(ended(statements, 'ROLLBACK')).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
