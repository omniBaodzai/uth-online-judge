import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { AuthSessionRepository } from './auth-session.repository.js';
import { AvatarStorageService } from './avatar-storage.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { ActivityLogService } from '../platform/activity-log.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { UsersService, type PublicUser, type UserRecord } from '../users/users.service.js';

const BCRYPT_COST = 12;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = '$2b$12$donv/cj6TyYj20d2wA2yT.PWwKPymRVkCAbrbtr8VQk7S0i3E0pUu';
const INVALID_CREDENTIALS = 'Tên đăng nhập/email hoặc mật khẩu không chính xác.';

export type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: AuthSessionRepository,
    private readonly jwt: JwtService,
    private readonly avatars: AvatarStorageService,
    private readonly activity: ActivityLogService,
    private readonly settings: SettingsService,
  ) {}

  async register(input: RegisterDto): Promise<AuthResult> {
    if (!(await this.settings.get()).features.registration) {
      throw new ForbiddenException('Hệ thống đang tạm dừng đăng ký tài khoản mới.');
    }
    if (Buffer.byteLength(input.password, 'utf8') > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 byte.');
    }

    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    let user: PublicUser;
    try {
      user = await this.users.create({ username, email, passwordHash });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Tên đăng nhập hoặc email đã được sử dụng.');
      }
      throw error;
    }
    await this.activity.log({ userId: user.id, action: 'REGISTER' });
    return this.createSession(user);
  }

  async login(identifier: string, password: string): Promise<AuthResult> {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await this.users.findByIdentifier(normalizedIdentifier);
    const matches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

    if (!user || !user.is_active || !user.password_hash || !matches) {
      if (user) await this.activity.log({ userId: user.id, action: user.is_active ? 'LOGIN_FAILED' : 'LOGIN_BLOCKED' });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.activity.log({ userId: user.id, action: 'LOGIN' });
    return this.createSession(user);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const nextRefreshToken = createRefreshToken();
    const userId = await this.sessions.rotate(
      hashRefreshToken(refreshToken),
      hashRefreshToken(nextRefreshToken),
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    );

    if (!userId) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const user = await this.users.findById(userId);
    if (!user || !user.is_active) {
      await this.sessions.revoke(hashRefreshToken(nextRefreshToken));
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    return this.createSessionResult(user, nextRefreshToken);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.sessions.revoke(hashRefreshToken(refreshToken));
    }
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }
    return user;
  }

  async updateProfile(
    userId: string,
    input: { fullName?: string | null; avatarUrl?: string | null },
  ): Promise<PublicUser> {
    if (!Object.hasOwn(input, 'fullName') && !Object.hasOwn(input, 'avatarUrl')) {
      throw new BadRequestException('Hãy nhập ít nhất một thông tin cần cập nhật.');
    }

    const previous = await this.users.findById(userId);
    const user = await this.users.updateProfile(userId, input);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }
    if (previous && previous.avatar_url !== user.avatar_url) {
      await this.avatars.remove(previous.avatar_url);
    }
    return user;
  }

  async uploadAvatar(
    userId: string,
    file: Buffer | undefined,
    input: { fullName?: string | null } = {},
  ): Promise<PublicUser> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn một tệp ảnh.');
    }

    const avatarUrl = await this.avatars.save(file);
    try {
      return await this.updateProfile(userId, {
        ...(Object.hasOwn(input, 'fullName') ? { fullName: input.fullName } : {}),
        avatarUrl,
      });
    } catch (error) {
      await this.avatars.remove(avatarUrl);
      throw error;
    }
  }

  private async createSession(user: UserRecord | PublicUser): Promise<AuthResult> {
    const refreshToken = createRefreshToken();
    await this.sessions.create(
      user.id,
      hashRefreshToken(refreshToken),
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    );
    return this.createSessionResult(user, refreshToken);
  }

  private async createSessionResult(
    user: UserRecord | PublicUser,
    refreshToken: string,
  ): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function toPublicUser(user: UserRecord | PublicUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    avatar_url: user.avatar_url,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
