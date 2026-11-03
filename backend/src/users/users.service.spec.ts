import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { ProfileUpdateDto } from '../auth/dto/profile-update.dto.js';
import { UsersService } from './users.service.js';

describe('UsersService.updateProfile', () => {
  it('persists only supplied profile fields and includes organization updates', async () => {
    const updatedUser = {
      id: 'user-id',
      username: 'coder',
      email: 'private@example.com',
      full_name: 'Coder',
      avatar_url: null,
      cover_image_url: 'https://example.com/cover.jpg',
      cover_crop: null,
      bio: 'Hello',
      organization: 'UTH',
      is_active: true,
      auth_version: 0,
      role: 'STUDENT',
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-02T00:00:00Z'),
    };
    const query = vi.fn().mockResolvedValue({ rows: [updatedUser] });
    const service = new UsersService({ query } as never);

    const input = plainToInstance(ProfileUpdateDto, {
      fullName: 'Coder',
      coverImageUrl: 'https://example.com/cover.jpg',
      bio: 'Hello',
      organization: 'UTH',
    });

    expect(Object.hasOwn(input, 'avatarUrl')).toBe(true);
    expect(input.avatarUrl).toBeUndefined();

    await expect(service.updateProfile('user-id', input)).resolves.toEqual(
      updatedUser,
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'organization = CASE WHEN $12 THEN $13 ELSE organization END',
      ),
      [
        'user-id',
        true,
        'Coder',
        false,
        null,
        true,
        'https://example.com/cover.jpg',
        true,
        null,
        true,
        'Hello',
        true,
        'UTH',
      ],
    );
  });

  it('updates only the supplied name when the DTO contains other undefined fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    const service = new UsersService({ query } as never);
    const input = plainToInstance(ProfileUpdateDto, {
      fullName: 'Changed name',
    });

    await service.updateProfile('user-id', input);

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      'user-id',
      true,
      'Changed name',
      false,
      null,
      false,
      null,
      false,
      null,
      false,
      null,
      false,
      null,
    ]);
  });

  it('updates only the supplied avatar without clearing the name', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    const service = new UsersService({ query } as never);
    const input = plainToInstance(ProfileUpdateDto, {
      avatarUrl: '/uploads/avatar.webp',
    });

    await service.updateProfile('user-id', input);

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      'user-id',
      false,
      null,
      true,
      '/uploads/avatar.webp',
      false,
      null,
      false,
      null,
      false,
      null,
      false,
      null,
    ]);
  });

  it('preserves explicit null and empty-string values as distinct updates', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    const service = new UsersService({ query } as never);

    await service.updateProfile('user-id', { fullName: null, bio: '' });

    const values = query.mock.calls[0]?.[1] as unknown[];
    expect(values[1]).toBe(true);
    expect(values[2]).toBeNull();
    expect(values[9]).toBe(true);
    expect(values[10]).toBe('');
  });
});

describe('UsersService.updatePassword', () => {
  it('updates the password only when the expected hash still matches', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rowCount: 1, rows: [{ id: 'user-id' }] });
    const service = new UsersService({ query } as never);

    await expect(
      service.updatePassword('user-id', 'old-hash', 'new-hash'),
    ).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('password_hash = $3'),
      ['user-id', 'old-hash', 'new-hash'],
    );
    expect(query.mock.calls[0]?.[0]).toContain('password_hash = $2');
    expect(query.mock.calls[0]?.[0]).toContain('is_active = TRUE');
    expect(query.mock.calls[0]?.[0]).toContain(
      'auth_version = auth_version + 1',
    );
  });
});

describe('UsersService Google accounts', () => {
  it('looks up Google identities by the unique provider subject', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'user-id' }] });
    const service = new UsersService({ query } as never);

    await expect(service.findByGoogleId('google-sub')).resolves.toEqual({
      id: 'user-id',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE google_id = $1'),
      ['google-sub'],
    );
    expect(query.mock.calls[0]?.[0]).not.toContain('password_hash');
  });

  it('checks email case-insensitively without linking it to a provider', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [{ id: 'existing-user' }] });
    const service = new UsersService({ query } as never);

    await service.findByEmail('student@example.com');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE lower(email) = $1'),
      ['student@example.com'],
    );
  });

  it('inserts a Google-only account without a password credential', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'new-user' }] });
    const service = new UsersService({ query } as never);

    await expect(
      service.createGoogleAccount({
        username: 'student',
        email: 'student@example.com',
        googleId: 'google-sub',
        fullName: 'Student',
      }),
    ).resolves.toEqual({ id: 'new-user' });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'INSERT INTO users (username, email, password_hash, full_name, google_id)',
      ),
      ['student', 'student@example.com', 'Student', 'google-sub'],
    );
    expect(query.mock.calls[0]?.[0]).toContain('VALUES ($1, $2, NULL, $3, $4)');
  });
});

describe('UsersService GitHub accounts', () => {
  it('looks up GitHub identities by the provider numeric ID', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'user-id' }] });
    const service = new UsersService({ query } as never);

    await expect(service.findByGitHubId('123456')).resolves.toEqual({
      id: 'user-id',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE github_id = $1'),
      ['123456'],
    );
    expect(query.mock.calls[0]?.[0]).not.toContain('password_hash');
  });

  it('inserts a GitHub-only account without a password credential', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'new-user' }] });
    const service = new UsersService({ query } as never);

    await expect(
      service.createGitHubAccount({
        username: 'student',
        email: 'student@example.com',
        githubId: '123456',
        fullName: 'Student',
      }),
    ).resolves.toEqual({ id: 'new-user' });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'INSERT INTO users (username, email, password_hash, full_name, github_id)',
      ),
      ['student', 'student@example.com', 'Student', '123456'],
    );
    expect(query.mock.calls[0]?.[0]).toContain('VALUES ($1, $2, NULL, $3, $4)');
  });
});
