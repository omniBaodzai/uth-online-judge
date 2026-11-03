import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { AuthSessionRepository } from './auth-session.repository.js';
import { AvatarStorageService } from './avatar-storage.service.js';
import { CoverStorageService } from './cover-storage.service.js';
import { RegisterDto } from './dto/register.dto.js';
import type { VerifiedGitHubIdentity } from './github-oauth.service.js';
import {
  UsersService,
  type AuthenticatedUser,
  type CoverCropMetadata,
  type PublicUser,
  type UserRecord,
} from '../users/users.service.js';
import type { VerifiedGoogleIdentity } from './google-oauth.service.js';

const BCRYPT_COST = 12;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  '$2b$12$donv/cj6TyYj20d2wA2yT.PWwKPymRVkCAbrbtr8VQk7S0i3E0pUu';
const INVALID_CREDENTIALS =
  'Tên đăng nhập/email hoặc mật khẩu không chính xác.';

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
    private readonly covers: CoverStorageService,
  ) {}

  async register(input: RegisterDto): Promise<AuthResult> {
    if (Buffer.byteLength(input.password, 'utf8') > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 byte.');
    }

    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    let user: AuthenticatedUser;
    try {
      user = await this.users.create({ username, email, passwordHash });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Tên đăng nhập hoặc email đã được sử dụng.',
        );
      }
      throw error;
    }
    return this.createSession(user);
  }

  async login(identifier: string, password: string): Promise<AuthResult> {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await this.users.findByIdentifier(normalizedIdentifier);
    const matches = await bcrypt.compare(
      password,
      user?.password_hash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !user.is_active || !user.password_hash || !matches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return this.createSession(user);
  }

  async loginWithGoogle(identity: VerifiedGoogleIdentity): Promise<AuthResult> {
    const googleId = identity.googleId.trim();
    const email = identity.email.trim().toLowerCase();
    if (!googleId || !email || identity.emailVerified !== true) {
      throw new UnauthorizedException('Không thể xác minh tài khoản Google.');
    }

    const linkedUser = await this.users.findByGoogleId(googleId);
    if (linkedUser) return this.createSessionForActiveUser(linkedUser);

    const emailUser = await this.users.findByEmail(email);
    if (emailUser) {
      throw new ConflictException(
        'Email Google này đã có tài khoản. Vui lòng đăng nhập bằng phương thức hiện tại.',
      );
    }

    const usernameBase = googleUsernameBase(email);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${attempt}`;
      const username = `${usernameBase.slice(0, 32 - suffix.length)}${suffix}`;
      try {
        const user = await this.users.createGoogleAccount({
          username,
          email,
          googleId,
          fullName: identity.fullName?.trim().slice(0, 100) || null,
        });
        return this.createSessionForActiveUser(user);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;

        const racedGoogleUser = await this.users.findByGoogleId(googleId);
        if (racedGoogleUser)
          return this.createSessionForActiveUser(racedGoogleUser);

        const racedEmailUser = await this.users.findByEmail(email);
        if (racedEmailUser) {
          throw new ConflictException(
            'Email Google này đã có tài khoản. Vui lòng đăng nhập bằng phương thức hiện tại.',
          );
        }
      }
    }

    throw new ConflictException(
      'Không thể tạo tên đăng nhập cho tài khoản Google này.',
    );
  }

  async loginWithGitHub(identity: VerifiedGitHubIdentity): Promise<AuthResult> {
    const githubId = identity.githubId.trim();
    const email = identity.email.trim().toLowerCase();
    if (!/^\d+$/.test(githubId) || !email || identity.emailVerified !== true) {
      throw new UnauthorizedException('Không thể xác minh tài khoản GitHub.');
    }

    const linkedUser = await this.users.findByGitHubId(githubId);
    if (linkedUser) return this.createSessionForActiveUser(linkedUser);

    const emailUser = await this.users.findByEmail(email);
    if (emailUser) {
      throw new ConflictException(
        'Email GitHub này đã có tài khoản. Vui lòng đăng nhập bằng phương thức hiện tại.',
      );
    }

    const usernameBase = githubUsernameBase(email);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${attempt}`;
      const username = `${usernameBase.slice(0, 32 - suffix.length)}${suffix}`;
      try {
        const user = await this.users.createGitHubAccount({
          username,
          email,
          githubId,
          fullName: identity.fullName?.trim().slice(0, 100) || null,
        });
        return this.createSessionForActiveUser(user);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;

        const racedGitHubUser = await this.users.findByGitHubId(githubId);
        if (racedGitHubUser)
          return this.createSessionForActiveUser(racedGitHubUser);

        const racedEmailUser = await this.users.findByEmail(email);
        if (racedEmailUser) {
          throw new ConflictException(
            'Email GitHub này đã có tài khoản. Vui lòng đăng nhập bằng phương thức hiện tại.',
          );
        }
      }
    }

    throw new ConflictException(
      'Không thể tạo tên đăng nhập cho tài khoản GitHub này.',
    );
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    const nextRefreshToken = createRefreshToken();
    const userId = await this.sessions.rotate(
      hashRefreshToken(refreshToken),
      hashRefreshToken(nextRefreshToken),
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    );

    if (!userId) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    const user = await this.users.findById(userId);
    if (!user || !user.is_active) {
      await this.sessions.revoke(hashRefreshToken(nextRefreshToken));
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    return this.createSessionResult(user, nextRefreshToken);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.sessions.revoke(hashRefreshToken(refreshToken));
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentRefreshToken?: string,
  ): Promise<void> {
    if (
      Buffer.byteLength(currentPassword, 'utf8') > 72 ||
      Buffer.byteLength(newPassword, 'utf8') > 72
    ) {
      throw new BadRequestException(
        'Mật khẩu không được vượt quá giới hạn 72 byte.',
      );
    }

    const credential = await this.users.findPasswordCredential(userId);
    if (!credential || !credential.is_active) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }
    if (!credential.password_hash) {
      throw new BadRequestException(
        'Tài khoản chưa thiết lập mật khẩu. Vui lòng sử dụng quy trình đặt lại mật khẩu.',
      );
    }
    if (!(await bcrypt.compare(currentPassword, credential.password_hash))) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
    }
    if (await bcrypt.compare(newPassword, credential.password_hash)) {
      throw new BadRequestException(
        'Mật khẩu mới phải khác mật khẩu hiện tại.',
      );
    }

    const nextPasswordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    const updated = await this.users.updatePassword(
      userId,
      credential.password_hash,
      nextPasswordHash,
    );
    if (!updated) {
      throw new ConflictException(
        'Thông tin mật khẩu đã thay đổi. Vui lòng thử lại.',
      );
    }

    await this.sessions.revokeAllExcept(
      userId,
      currentRefreshToken ? hashRefreshToken(currentRefreshToken) : undefined,
    );
  }

  async getPasswordStatus(userId: string): Promise<{ hasPassword: boolean }> {
    const credential = await this.users.findPasswordCredential(userId);
    if (!credential || !credential.is_active) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }
    return { hasPassword: credential.password_hash !== null };
  }

  async issueAccessToken(
    userId: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const user = await this.users.findById(userId);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }

    return {
      accessToken: await this.jwt.signAsync(
        { sub: user.id, ver: user.auth_version },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      ),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }
    return toPublicUser(user);
  }

  async updateProfile(
    userId: string,
    input: {
      fullName?: string | null;
      avatarUrl?: string | null;
      coverImageUrl?: string | null;
      coverCrop?: CoverCropMetadata | null;
      bio?: string | null;
      organization?: string | null;
    },
  ): Promise<PublicUser> {
    if (
      input.fullName === undefined &&
      input.avatarUrl === undefined &&
      input.coverImageUrl === undefined &&
      input.coverCrop === undefined &&
      input.bio === undefined &&
      input.organization === undefined
    ) {
      throw new BadRequestException(
        'Hãy nhập ít nhất một thông tin cần cập nhật.',
      );
    }

    const previous = await this.users.findById(userId);
    const user = await this.users.updateProfile(userId, input);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }
    if (previous && previous.avatar_url !== user.avatar_url) {
      await this.avatars.remove(previous.avatar_url);
    }
    if (previous && previous.cover_image_url !== user.cover_image_url) {
      await this.covers.remove(previous.cover_image_url);
    }
    return user;
  }

  async uploadCover(
    userId: string,
    file: Buffer | undefined,
    crop: CoverCropMetadata,
  ): Promise<PublicUser> {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh bìa.');
    validateCoverCrop(crop);
    const coverImageUrl = await this.covers.save(file);
    try {
      return await this.updateProfile(userId, {
        coverImageUrl,
        coverCrop: crop,
      });
    } catch (error) {
      await this.covers.remove(coverImageUrl);
      throw error;
    }
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
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        avatarUrl,
      });
    } catch (error) {
      await this.avatars.remove(avatarUrl);
      throw error;
    }
  }

  private async createSession(
    user: UserRecord | AuthenticatedUser,
  ): Promise<AuthResult> {
    const refreshToken = createRefreshToken();
    await this.sessions.create(
      user.id,
      hashRefreshToken(refreshToken),
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    );
    return this.createSessionResult(user, refreshToken);
  }

  private async createSessionForActiveUser(
    user: AuthenticatedUser,
  ): Promise<AuthResult> {
    if (!user.is_active) {
      throw new UnauthorizedException(
        'Tài khoản UTH này hiện không hoạt động.',
      );
    }
    return this.createSession(user);
  }

  private async createSessionResult(
    user: UserRecord | AuthenticatedUser,
    refreshToken: string,
  ): Promise<AuthResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, ver: user.auth_version },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
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

function googleUsernameBase(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const normalized = localPart
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 32);
  if (normalized.length >= 3) return normalized;
  return normalized ? `${normalized}user` : 'googleuser';
}

function githubUsernameBase(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const normalized = localPart
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 32);
  if (normalized.length >= 3) return normalized;
  return normalized ? `${normalized}user` : 'githubuser';
}

function toPublicUser(user: UserRecord | AuthenticatedUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    avatar_url: user.avatar_url,
    cover_image_url: user.cover_image_url,
    cover_crop: user.cover_crop,
    bio: user.bio,
    organization: user.organization,
    is_active: user.is_active,
    role: user.role,
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

function validateCoverCrop(crop: CoverCropMetadata): void {
  const values = [
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    crop.sourceWidth,
    crop.sourceHeight,
    crop.aspect,
  ];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.sourceWidth <= 0 ||
    crop.sourceHeight <= 0 ||
    crop.aspect <= 0 ||
    crop.x + crop.width > crop.sourceWidth + 1 ||
    crop.y + crop.height > crop.sourceHeight + 1 ||
    Math.abs(crop.width / crop.height - crop.aspect) > 0.02
  ) {
    throw new BadRequestException('Thông số cắt ảnh bìa không hợp lệ.');
  }
}
