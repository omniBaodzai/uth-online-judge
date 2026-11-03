import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthSessionRepository } from './auth-session.repository.js';
import { AvatarStorageService } from './avatar-storage.service.js';
import { AuthService, hashRefreshToken } from './auth.service.js';
import { ProfileUpdateDto } from './dto/profile-update.dto.js';
import {
  UsersService,
  type PublicUser,
  type UserRecord,
} from '../users/users.service.js';

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
  auth_version: 0,
  role: 'STUDENT',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    create: ReturnType<typeof vi.fn>;
    findByGoogleId: ReturnType<typeof vi.fn>;
    findByGitHubId: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    createGoogleAccount: ReturnType<typeof vi.fn>;
    createGitHubAccount: ReturnType<typeof vi.fn>;
    findByIdentifier: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findPasswordCredential: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
    updatePassword: ReturnType<typeof vi.fn>;
  };
  let sessions: {
    create: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let avatars: {
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let covers: {
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    avatars = { save: vi.fn(), remove: vi.fn().mockResolvedValue(undefined) };
    covers = { save: vi.fn(), remove: vi.fn().mockResolvedValue(undefined) };
    users = {
      create: vi.fn(),
      findByGoogleId: vi.fn(),
      findByGitHubId: vi.fn(),
      findByEmail: vi.fn(),
      createGoogleAccount: vi.fn(),
      createGitHubAccount: vi.fn(),
      findByIdentifier: vi.fn(),
      findById: vi.fn(),
      findPasswordCredential: vi.fn(),
      updateProfile: vi.fn(),
      updatePassword: vi.fn(),
    };
    sessions = {
      create: vi.fn().mockResolvedValue(undefined),
      rotate: vi.fn(),
      revoke: vi.fn().mockResolvedValue(undefined),
      revokeAllExcept: vi.fn().mockResolvedValue(undefined),
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

  it('reports whether the authenticated account already has a password', async () => {
    users.findPasswordCredential.mockResolvedValue({
      password_hash: null,
      is_active: true,
    });

    await expect(service.getPasswordStatus(user.id))
      .resolves.toEqual({ hasPassword: false });
    expect(users.findPasswordCredential).toHaveBeenCalledWith(user.id);
  });

  it('issues a fresh access token using the updated auth version after setup', async () => {
    users.findById.mockResolvedValue(authenticatedUser({ ...user, auth_version: 4 }));

    await expect(service.issueAccessToken(user.id)).resolves.toEqual({
      accessToken: 'access-token',
      expiresIn: 900,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: user.id, ver: 4 },
      expect.objectContaining({ expiresIn: 900 }),
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('normalizes registration data and returns no password or refresh hash', async () => {
    users.create.mockResolvedValue(authenticatedUser(user));

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
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: user.id, ver: user.auth_version },
      expect.any(Object),
    );
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

  it('rejects inactive users at login without creating a session', async () => {
    users.findByIdentifier.mockResolvedValue({ ...user, is_active: false });

    await expect(service.login('student01', 'password')).rejects.toMatchObject({
      constructor: UnauthorizedException,
      message: 'Tên đăng nhập/email hoặc mật khẩu không chính xác.',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashed-password');
    expect(sessions.create).not.toHaveBeenCalled();
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

  it('creates a session for an active account already linked to the Google subject', async () => {
    users.findByGoogleId.mockResolvedValue(authenticatedUser(user));

    const result = await service.loginWithGoogle({
      googleId: 'google-sub',
      email: user.email,
      emailVerified: true,
      fullName: null,
    });

    expect(users.findByGoogleId).toHaveBeenCalledWith('google-sub');
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(users.createGoogleAccount).not.toHaveBeenCalled();
    expect(result.user.id).toBe(user.id);
    expect(sessions.create).toHaveBeenCalledOnce();
  });

  it('rejects a linked Google account when the UTH account is inactive', async () => {
    users.findByGoogleId.mockResolvedValue(
      authenticatedUser({ ...user, is_active: false }),
    );

    await expect(
      service.loginWithGoogle({
        googleId: 'google-sub',
        email: user.email,
        emailVerified: true,
        fullName: null,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('does not auto-link a verified Google email to an existing password account', async () => {
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(authenticatedUser(user));

    await expect(
      service.loginWithGoogle({
        googleId: 'different-google-sub',
        email: ' Student@Example.com ',
        emailVerified: true,
        fullName: 'Google Name',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(users.createGoogleAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('creates a new Google account and issues the existing JWT and refresh session', async () => {
    const googleUser = authenticatedUser({
      ...user,
      username: 'new.user',
      email: 'new.user@example.com',
      password_hash: null,
      full_name: 'Google Name',
    });
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    users.createGoogleAccount.mockResolvedValue(googleUser);

    const result = await service.loginWithGoogle({
      googleId: 'google-sub',
      email: ' New.User@Example.com ',
      emailVerified: true,
      fullName: ' Google Name ',
    });

    expect(users.createGoogleAccount).toHaveBeenCalledWith({
      username: 'new.user',
      email: 'new.user@example.com',
      googleId: 'google-sub',
      fullName: 'Google Name',
    });
    expect(result.user.email).toBe('new.user@example.com');
    expect(result.accessToken).toBe('access-token');
    expect(sessions.create).toHaveBeenCalledWith(
      user.id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
  });

  it('generates usernames within the existing registration length and character rules', async () => {
    users.findByGoogleId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    users.createGoogleAccount.mockResolvedValue(
      authenticatedUser({ ...user, username: 'auser', email: 'a@example.com' }),
    );

    await service.loginWithGoogle({
      googleId: 'google-sub',
      email: 'a@example.com',
      emailVerified: true,
      fullName: null,
    });

    expect(users.createGoogleAccount).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'auser' }),
    );
  });

  it('reuses the Google account won by a concurrent unique-index race', async () => {
    users.findByGoogleId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(authenticatedUser(user));
    users.findByEmail.mockResolvedValue(null);
    users.createGoogleAccount.mockRejectedValue({ code: '23505' });

    const result = await service.loginWithGoogle({
      googleId: 'google-sub',
      email: user.email,
      emailVerified: true,
      fullName: null,
    });

    expect(result.user.id).toBe(user.id);
    expect(users.createGoogleAccount).toHaveBeenCalledOnce();
    expect(sessions.create).toHaveBeenCalledOnce();
  });

  it('creates a session for an active account linked by GitHub numeric ID', async () => {
    users.findByGitHubId.mockResolvedValue(authenticatedUser(user));

    const result = await service.loginWithGitHub({
      githubId: '123456',
      email: user.email,
      emailVerified: true,
      fullName: null,
    });

    expect(users.findByGitHubId).toHaveBeenCalledWith('123456');
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(users.createGitHubAccount).not.toHaveBeenCalled();
    expect(result.user.id).toBe(user.id);
    expect(sessions.create).toHaveBeenCalledOnce();
  });

  it('rejects a linked inactive GitHub account without creating a session', async () => {
    users.findByGitHubId.mockResolvedValue(
      authenticatedUser({ ...user, is_active: false }),
    );

    await expect(
      service.loginWithGitHub({
        githubId: '123456',
        email: user.email,
        emailVerified: true,
        fullName: null,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('does not link a GitHub identity to an existing account by email', async () => {
    users.findByGitHubId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(authenticatedUser(user));

    await expect(
      service.loginWithGitHub({
        githubId: '123456',
        email: user.email,
        emailVerified: true,
        fullName: 'GitHub User',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(users.createGitHubAccount).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('creates a GitHub account and issues the existing JWT and refresh session', async () => {
    const githubUser = authenticatedUser({
      ...user,
      username: 'github.user',
      email: 'github.user@example.com',
      password_hash: null,
      full_name: 'GitHub User',
    });
    users.findByGitHubId.mockResolvedValue(null);
    users.findByEmail.mockResolvedValue(null);
    users.createGitHubAccount.mockResolvedValue(githubUser);

    const result = await service.loginWithGitHub({
      githubId: '123456',
      email: ' GitHub.User@Example.com ',
      emailVerified: true,
      fullName: ' GitHub User ',
    });

    expect(users.createGitHubAccount).toHaveBeenCalledWith({
      username: 'github.user',
      email: 'github.user@example.com',
      githubId: '123456',
      fullName: 'GitHub User',
    });
    expect(result.user.email).toBe('github.user@example.com');
    expect(result.accessToken).toBe('access-token');
    expect(sessions.create).toHaveBeenCalledWith(
      user.id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
  });

  it('rejects a GitHub identity without a numeric ID or verified email', async () => {
    await expect(
      service.loginWithGitHub({
        githubId: 'octocat',
        email: user.email,
        emailVerified: true,
        fullName: null,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.loginWithGitHub({
        githubId: '123456',
        email: user.email,
        emailVerified: false,
        fullName: null,
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.findByGitHubId).not.toHaveBeenCalled();
  });

  it('reuses the GitHub account won by a concurrent unique-index race', async () => {
    users.findByGitHubId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(authenticatedUser(user));
    users.findByEmail.mockResolvedValue(null);
    users.createGitHubAccount.mockRejectedValue({ code: '23505' });

    const result = await service.loginWithGitHub({
      githubId: '123456',
      email: user.email,
      emailVerified: true,
      fullName: null,
    });

    expect(result.user.id).toBe(user.id);
    expect(sessions.create).toHaveBeenCalledOnce();
  });

  it('rotates refresh tokens and stores only the SHA-256 hash', async () => {
    sessions.rotate.mockImplementation(
      async (_current: string, next: string) => {
        expect(next).toMatch(/^[a-f0-9]{64}$/);
        return user.id;
      },
    );
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
    expect(sessions.revoke).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it('rejects refresh for an inactive user and revokes the rotated token', async () => {
    sessions.rotate.mockResolvedValue(user.id);
    users.findById.mockResolvedValue(publicUser({ ...user, is_active: false }));

    await expect(service.refresh('old-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(sessions.revoke).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('revokes only the supplied refresh-token session on logout', async () => {
    await service.logout('current-refresh-token');

    expect(sessions.revoke).toHaveBeenCalledWith(
      hashRefreshToken('current-refresh-token'),
    );
  });

  it('changes the authenticated user password and preserves only the current refresh session', async () => {
    users.findPasswordCredential.mockResolvedValue({
      password_hash: 'old-password-hash',
      is_active: true,
    });
    users.updatePassword.mockResolvedValue(true);
    vi.mocked(bcrypt.hash).mockResolvedValue('new-password-hash');
    vi.mocked(bcrypt.compare)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await service.changePassword(
      user.id,
      'current-password',
      'new-password',
      'current-refresh-token',
    );

    expect(bcrypt.compare).toHaveBeenNthCalledWith(
      1,
      'current-password',
      'old-password-hash',
    );
    expect(bcrypt.compare).toHaveBeenNthCalledWith(
      2,
      'new-password',
      'old-password-hash',
    );
    expect(bcrypt.hash).toHaveBeenCalledWith('new-password', 12);
    expect(users.updatePassword).toHaveBeenCalledWith(
      user.id,
      'old-password-hash',
      'new-password-hash',
    );
    expect(sessions.revokeAllExcept).toHaveBeenCalledWith(
      user.id,
      hashRefreshToken('current-refresh-token'),
    );
  });

  it('rejects an incorrect current password without updating credentials', async () => {
    users.findPasswordCredential.mockResolvedValue({
      password_hash: 'old-password-hash',
      is_active: true,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false);

    await expect(
      service.changePassword(user.id, 'wrong-password', 'new-password'),
    ).rejects.toMatchObject({ message: 'Mật khẩu hiện tại không chính xác.' });
    expect(users.updatePassword).not.toHaveBeenCalled();
    expect(sessions.revokeAllExcept).not.toHaveBeenCalled();
  });

  it('does not assume OAuth-only accounts have a password', async () => {
    users.findPasswordCredential.mockResolvedValue({
      password_hash: null,
      is_active: true,
    });

    await expect(
      service.changePassword(user.id, 'current', 'new-password'),
    ).rejects.toMatchObject({
      message:
        'Tài khoản chưa thiết lập mật khẩu. Vui lòng sử dụng quy trình đặt lại mật khẩu.',
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects a password that is unchanged or exceeds bcrypt byte limits', async () => {
    users.findPasswordCredential.mockResolvedValue({
      password_hash: 'old-password-hash',
      is_active: true,
    });
    vi.mocked(bcrypt.compare)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      service.changePassword(user.id, 'same-password', 'same-password'),
    ).rejects.toMatchObject({
      message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    });
    await expect(
      service.changePassword(user.id, 'current', 'é'.repeat(37)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it('updates only the current user profile fields', async () => {
    const updated = { ...publicUser(user), full_name: 'Student Name' };
    users.updateProfile.mockResolvedValue(updated);

    await expect(
      service.updateProfile(user.id, { fullName: 'Student Name' }),
    ).resolves.toEqual(updated);
    expect(users.updateProfile).toHaveBeenCalledWith(user.id, {
      fullName: 'Student Name',
    });
  });

  it('rejects empty profile updates', async () => {
    await expect(service.updateProfile(user.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.updateProfile(user.id, new ProfileUpdateDto()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.updateProfile).not.toHaveBeenCalled();
  });

  it('removes the previous uploaded avatar when the avatar changes', async () => {
    const oldAvatar =
      '/uploads/avatars/a83d7d70-2c6b-485e-a2da-ec1d571908fc.png';
    users.findById.mockResolvedValue({
      ...publicUser(user),
      avatar_url: oldAvatar,
    });
    users.updateProfile.mockResolvedValue({
      ...publicUser(user),
      avatar_url: null,
    });

    await service.updateProfile(user.id, { avatarUrl: null });

    expect(avatars.remove).toHaveBeenCalledWith(oldAvatar);
  });

  it('keeps the previous avatar when only the name changes', async () => {
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue({
      ...publicUser(user),
      full_name: 'A',
    });

    await service.updateProfile(user.id, { fullName: 'A' });

    expect(avatars.remove).not.toHaveBeenCalled();
  });

  it('stores an uploaded avatar and links it to the current user', async () => {
    const stored = '/uploads/avatars/new.png';
    avatars.save.mockResolvedValue(stored);
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue({
      ...publicUser(user),
      avatar_url: stored,
    });

    await expect(
      service.uploadAvatar(user.id, Buffer.from('x')),
    ).resolves.toMatchObject({
      avatar_url: stored,
    });
    expect(users.updateProfile).toHaveBeenCalledWith(user.id, {
      avatarUrl: stored,
    });
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

    await service.uploadAvatar(user.id, Buffer.from('image'), {
      fullName: 'Student Name',
    });

    expect(users.updateProfile).toHaveBeenCalledWith(user.id, {
      fullName: 'Student Name',
      avatarUrl: stored,
    });
  });

  it('does not clear the full name when avatar upload DTO leaves it undefined', async () => {
    const stored = '/uploads/avatars/new.webp';
    avatars.save.mockResolvedValue(stored);
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue({
      ...publicUser(user),
      avatar_url: stored,
    });
    const input = new ProfileUpdateDto();
    expect(Object.hasOwn(input, 'fullName')).toBe(true);

    await service.uploadAvatar(user.id, Buffer.from('image'), input);

    expect(users.updateProfile).toHaveBeenCalledWith(user.id, {
      avatarUrl: stored,
    });
  });

  it('deletes the stored file when the profile update fails', async () => {
    avatars.save.mockResolvedValue('/uploads/avatars/new.png');
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue(null);

    await expect(
      service.uploadAvatar(user.id, Buffer.from('x')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(avatars.remove).toHaveBeenCalledWith('/uploads/avatars/new.png');
  });

  it('rejects an avatar upload without a file', async () => {
    await expect(
      service.uploadAvatar(user.id, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores the cover and crop metadata for the authenticated user', async () => {
    const crop = {
      x: 10,
      y: 20,
      width: 1280,
      height: 400,
      sourceWidth: 1600,
      sourceHeight: 900,
      aspect: 3.2,
    };
    const stored = '/uploads/covers/cover.webp';
    covers.save.mockResolvedValue(stored);
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue({
      ...publicUser(user),
      cover_image_url: stored,
      cover_crop: crop,
    });

    await expect(
      service.uploadCover(user.id, Buffer.from('image'), crop),
    ).resolves.toMatchObject({
      cover_image_url: stored,
      cover_crop: crop,
    });
    expect(users.updateProfile).toHaveBeenCalledWith(user.id, {
      coverImageUrl: stored,
      coverCrop: crop,
    });
  });

  it('rejects missing files and invalid crop metadata before storage', async () => {
    await expect(
      service.uploadCover(user.id, undefined, {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        sourceWidth: 1,
        sourceHeight: 1,
        aspect: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadCover(user.id, Buffer.from('image'), {
        x: 200,
        y: 0,
        width: 100,
        height: 100,
        sourceWidth: 100,
        sourceHeight: 100,
        aspect: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(covers.save).not.toHaveBeenCalled();
  });

  it('removes a newly stored cover if the database update fails', async () => {
    const stored = '/uploads/covers/cover.webp';
    const crop = {
      x: 0,
      y: 0,
      width: 1280,
      height: 400,
      sourceWidth: 1280,
      sourceHeight: 400,
      aspect: 3.2,
    };
    covers.save.mockResolvedValue(stored);
    users.findById.mockResolvedValue(publicUser(user));
    users.updateProfile.mockResolvedValue(null);

    await expect(
      service.uploadCover(user.id, Buffer.from('image'), crop),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(covers.remove).toHaveBeenCalledWith(stored);
  });

  it('removes a previous managed cover after a profile URL replacement', async () => {
    const previous = {
      ...publicUser(user),
      cover_image_url: '/uploads/covers/old.webp',
    };
    users.findById.mockResolvedValue(previous);
    users.updateProfile.mockResolvedValue({
      ...previous,
      cover_image_url: 'https://example.com/new.jpg',
      cover_crop: null,
    });

    await service.updateProfile(user.id, {
      coverImageUrl: 'https://example.com/new.jpg',
    });
    expect(covers.remove).toHaveBeenCalledWith(previous.cover_image_url);
  });
});

function publicUser(record: UserRecord): PublicUser {
  const {
    password_hash: _passwordHash,
    auth_version: _authVersion,
    ...result
  } = record;
  return result;
}

function authenticatedUser(record: UserRecord) {
  const { password_hash: _passwordHash, ...result } = record;
  return result;
}
