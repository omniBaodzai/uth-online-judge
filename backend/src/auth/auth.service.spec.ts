import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthSessionRepository } from './auth-session.repository.js';
import { AvatarStorageService } from './avatar-storage.service.js';
import { AuthService, hashRefreshToken } from './auth.service.js';
import { UsersService, type PublicUser, type UserRecord } from '../users/users.service.js';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

const user: UserRecord = {
  id: 'a83d7d70-2c6b-485e-a2da-ec1d571908fc',
  username: 'student01',
  email: 'student@example.com',
  password_hash: 'hashed-password',
  full_name: null,
  avatar_url: null,
  cover_image_url: null,
  cover_crop: null,
  bio: null,
  organization: null,
  is_active: true,
  role: 'STUDENT',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    create: ReturnType<typeof vi.fn>;
    findByIdentifier: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
  };
  let sessions: {
    create: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let avatars: { save: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  let covers: { save: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    avatars = { save: vi.fn(), remove: vi.fn().mockResolvedValue(undefined) };
    covers = { save: vi.fn(), remove: vi.fn().mockResolvedValue(undefined) };
    users = {
      create: vi.fn(),
      findByIdentifier: vi.fn(),
      findById: vi.fn(),
      updateProfile: vi.fn(),
    };
    sessions = {
      create: vi.fn().mockResolvedValue(undefined),
      rotate: vi.fn(),
      revoke: vi.fn().mockResolvedValue(undefined),
    };
    jwt = { signAsync: vi.fn().mockResolvedValue('access-token') };
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password');
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
    service = new AuthService(
      users as unknown as UsersService,
      sessions as unknown as AuthSessionRepository,
      jwt as unknown as JwtService,
      avatars as unknown as AvatarStorageService,
      covers as never,
    );
  });

  it('normalizes registration data and returns no password or refresh hash', async () => {
    users.create.mockResolvedValue(publicUser(user));

    const result = await service.register({
      username: ' Student01 ',
      email: ' Student@Example.com ',
      password: 'long-enough-password',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('long-enough-password', 12);
    expect(users.create).toHaveBeenCalledWith({
      username: 'student01',
      email: 'student@example.com',
      passwordHash: 'hashed-password',
    });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result).not.toHaveProperty('token_hash');
    expect(result.accessToken).toBe('access-token');
    expect(result.expiresIn).toBe(900);
    expect(sessions.create).toHaveBeenCalledWith(
      user.id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
  });

  it('rejects a duplicate username or email without creating a session', async () => {
    users.create.mockRejectedValue({ code: '23505' });

    await expect(
      service.register({
        username: 'student01',
        email: 'student@example.com',
        password: 'long-enough-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects passwords exceeding bcrypt byte limit', async () => {
    await expect(
      service.register({
        username: 'student01',
        email: 'student@example.com',
        password: 'é'.repeat(37),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('authenticates with normalized username or email', async () => {
    users.findByIdentifier.mockResolvedValue(user);

    const result = await service.login(' Student@Example.com ', 'password');

    expect(users.findByIdentifier).toHaveBeenCalledWith('student@example.com');
    expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashed-password');
    expect(result.user.id).toBe(user.id);
  });

  it('returns the same generic error for unknown users and incorrect passwords', async () => {
    users.findByIdentifier.mockResolvedValue(null);
    vi.mocked(bcrypt.compare).mockResolvedValue(false);

    await expect(service.login('unknown', 'password')).rejects.toMatchObject({
      constructor: UnauthorizedException,
      message: 'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
    });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rotates refresh tokens and stores only the SHA-256 hash', async () => {
    sessions.rotate.mockImplementation(async (_current: string, next: string) => {
      expect(next).toMatch(/^[a-f0-9]{64}$/);
      return user.id;
    });
    users.findById.mockResolvedValue(publicUser(user));

    const result = await service.refresh('old-refresh-token');

    expect(sessions.rotate).toHaveBeenCalledWith(
      hashRefreshToken('old-refresh-token'),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(result.refreshToken).not.toBe('old-refresh-token');
    expect(result.user).not.toHaveProperty('password_hash');
    expect(sessions.create).not.toHaveBeenCalled();
    expect(sessions.rotate).toHaveBeenCalledOnce();
  });

  it('revokes the rotated token if its user is no longer active', async () => {
    sessions.rotate.mockResolvedValue(user.id);
    users.findById.mockResolvedValue(null);

    await expect(service.refresh('old-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.revoke).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
  });

  it('revokes only the supplied refresh-token session on logout', async () => {
    await service.logout('current-refresh-token');

    expect(sessions.revoke).toHaveBeenCalledWith(hashRefreshToken('current-refresh-token'));
  });

  it('updates only the current user profile fields', async () => {
    const updated = { ...publicUser(user), full_name: 'Student Name' };
    users.updateProfile.mockResolvedValue(updated);

    await expect(
      service.updateProfile(user.id, { fullName: 'Student Name' }),
    ).resolves.toEqual(updated);
    expect(users.updateProfile).toHaveBeenCalledWith(user.id, { fullName: 'Student Name' });
  });

  it('rejects empty profile updates', async () => {
    await expect(service.updateProfile(user.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.updateProfile).not.toHaveBeenCalled();
  });

  it('removes the previous uploaded avatar when the avatar changes', async () => {
    const oldAvatar = '/uploads/avatars/a83d7d70-2c6b-485e-a2da-ec1d571908fc.png';
    users.findById.mockResolvedValue({ ...publicUser(user), avatar_url: oldAvatar });
    users.updateProfile.mockResolvedValue({ ...publicUser(user), avatar_url: null });

    await service.updateProfile(user.id, { avatarUrl: null });

    expect(avatars.remove).toHaveBeenCalledWith(oldAvatar);
  });

  it('keeps the previous avatar when only the name changes', async () => {
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue({ ...publicUser(user), full_name: 'A' });

    await service.updateProfile(user.id, { fullName: 'A' });

    expect(avatars.remove).not.toHaveBeenCalled();
  });

  it('stores an uploaded avatar and links it to the current user', async () => {
    const stored = '/uploads/avatars/new.png';
    avatars.save.mockResolvedValue(stored);
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue({ ...publicUser(user), avatar_url: stored });

    await expect(service.uploadAvatar(user.id, Buffer.from('x'))).resolves.toMatchObject({
      avatar_url: stored,
    });
    expect(users.updateProfile).toHaveBeenCalledWith(user.id, { avatarUrl: stored });
  });

  it('updates the full name together with an uploaded avatar', async () => {
    const stored = '/uploads/avatars/new.png';
    avatars.save.mockResolvedValue(stored);
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue({
      ...publicUser(user),
      full_name: 'Student Name',
      avatar_url: stored,
    });

    await service.uploadAvatar(user.id, Buffer.from('image'), { fullName: 'Student Name' });

    expect(users.updateProfile).toHaveBeenCalledWith(user.id, {
      fullName: 'Student Name',
      avatarUrl: stored,
    });
  });

  it('deletes the stored file when the profile update fails', async () => {
    avatars.save.mockResolvedValue('/uploads/avatars/new.png');
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue(null);

    await expect(service.uploadAvatar(user.id, Buffer.from('x'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(avatars.remove).toHaveBeenCalledWith('/uploads/avatars/new.png');
  });

  it('rejects an avatar upload without a file', async () => {
    await expect(service.uploadAvatar(user.id, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('stores the cover and crop metadata for the authenticated user', async () => {
    const crop = { x: 10, y: 20, width: 1280, height: 400, sourceWidth: 1600, sourceHeight: 900, aspect: 3.2 };
    const stored = '/uploads/covers/cover.webp';
    covers.save.mockResolvedValue(stored);
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue({ ...publicUser(user), cover_image_url: stored, cover_crop: crop });

    await expect(service.uploadCover(user.id, Buffer.from('image'), crop)).resolves.toMatchObject({
      cover_image_url: stored,
      cover_crop: crop,
    });
    expect(users.updateProfile).toHaveBeenCalledWith(user.id, { coverImageUrl: stored, coverCrop: crop });
  });

  it('rejects missing files and invalid crop metadata before storage', async () => {
    await expect(service.uploadCover(user.id, undefined, {
      x: 0, y: 0, width: 1, height: 1, sourceWidth: 1, sourceHeight: 1, aspect: 1,
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.uploadCover(user.id, Buffer.from('image'), {
      x: 200, y: 0, width: 100, height: 100, sourceWidth: 100, sourceHeight: 100, aspect: 1,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(covers.save).not.toHaveBeenCalled();
  });

  it('removes a newly stored cover if the database update fails', async () => {
    const stored = '/uploads/covers/cover.webp';
    const crop = { x: 0, y: 0, width: 1280, height: 400, sourceWidth: 1280, sourceHeight: 400, aspect: 3.2 };
    covers.save.mockResolvedValue(stored);
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue(null);

    await expect(service.uploadCover(user.id, Buffer.from('image'), crop)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(covers.remove).toHaveBeenCalledWith(stored);
  });

  it('removes a previous managed cover after a profile URL replacement', async () => {
    const previous = { ...publicUser(user), cover_image_url: '/uploads/covers/old.webp' };
    users.findById.mockResolvedValue(previous);
    users.updateProfile.mockResolvedValue({ ...previous, cover_image_url: 'https://example.com/new.jpg', cover_crop: null });

    await service.updateProfile(user.id, { coverImageUrl: 'https://example.com/new.jpg' });
    expect(covers.remove).toHaveBeenCalledWith(previous.cover_image_url);
  });
});

function publicUser(record: UserRecord): PublicUser {
  const { password_hash: _passwordHash, ...result } = record;
  return result;
}
