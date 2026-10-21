import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthSessionRepository } from './auth-session.repository.js';
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
  is_active: true,
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

  beforeEach(() => {
    vi.clearAllMocks();
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
});

function publicUser(record: UserRecord): PublicUser {
  const { password_hash: _passwordHash, ...result } = record;
  return result;
}
