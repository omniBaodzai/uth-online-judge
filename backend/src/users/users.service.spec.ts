import { describe, expect, it, vi } from 'vitest';
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

    await expect(service.updateProfile('user-id', {
      fullName: 'Coder',
      coverImageUrl: 'https://example.com/cover.jpg',
      bio: 'Hello',
      organization: 'UTH',
    })).resolves.toEqual(updatedUser);

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
});
