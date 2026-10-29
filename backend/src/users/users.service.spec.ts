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

    await expect(service.updateProfile('user-id', input)).resolves.toEqual(updatedUser);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('organization = CASE WHEN $12 THEN $13 ELSE organization END'),
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
    const input = plainToInstance(ProfileUpdateDto, { fullName: 'Changed name' });

    await service.updateProfile('user-id', input);

    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      [
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
      ],
    );
  });

  it('updates only the supplied avatar without clearing the name', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    const service = new UsersService({ query } as never);
    const input = plainToInstance(ProfileUpdateDto, { avatarUrl: '/uploads/avatar.webp' });

    await service.updateProfile('user-id', input);

    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      [
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
      ],
    );
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
