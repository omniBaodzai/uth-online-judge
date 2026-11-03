import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PasswordResetEmailService } from './password-reset-email.service.js';
import {
  PasswordResetRepository,
  type PasswordChallengePurpose,
} from './password-reset.repository.js';

const BCRYPT_COST = 12;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const GENERIC_REQUEST_MESSAGE =
  'Nếu email thuộc tài khoản đang hoạt động, mã xác nhận sẽ được gửi đến địa chỉ đó.';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly repository: PasswordResetRepository,
    private readonly emailService: PasswordResetEmailService,
  ) {}

  async requestOtp(emailInput: string, ipAddress: string): Promise<{
    message: string;
    retryAfterSeconds: number;
  }> {
    const email = emailInput.trim().toLowerCase();
    const emailHash = hashSecretValue(email);
    const ipHash = hashSecretValue(ipAddress);
    const retryAfterSeconds = await this.repository.consumeRequestRateLimit(emailHash, ipHash);
    if (retryAfterSeconds !== null) {
      throw new HttpException({
        message: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng đợi trước khi thử lại.',
        retryAfterSeconds,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const account = await this.repository.findEligibleAccount(email);
    if (account) {
      const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
      try {
        await this.emailService.sendOtp(account.email, otp);
      } catch (error) {
        this.logger.error(
          'Password reset email delivery failed.',
          error instanceof Error ? error.stack : undefined,
        );
        return { message: GENERIC_REQUEST_MESSAGE, retryAfterSeconds: 60 };
      }
      await this.repository.storeOtp(
        account.id,
        emailHash,
        account.auth_version,
        hashOtp(otp, 'PASSWORD_RESET'),
        new Date(Date.now() + OTP_TTL_MS),
        'PASSWORD_RESET',
      );
    }

    return { message: GENERIC_REQUEST_MESSAGE, retryAfterSeconds: 60 };
  }

  async verifyOtp(emailInput: string, otp: string): Promise<{ resetToken: string }> {
    const email = emailInput.trim().toLowerCase();
    const resetToken = randomBytes(32).toString('base64url');
    const verified = await this.repository.verifyOtp(
      email,
      hashSecretValue(email),
      hashOtp(otp, 'PASSWORD_RESET'),
      hashResetToken(resetToken),
      new Date(Date.now() + RESET_TOKEN_TTL_MS),
      'PASSWORD_RESET',
    );
    if (!verified) {
      throw new BadRequestException('Mã xác nhận không hợp lệ, đã hết hạn hoặc đã bị khóa.');
    }
    return { resetToken };
  }

  async requestPasswordSetupOtp(
    userId: string,
    ipAddress: string,
  ): Promise<{
    message: string;
    transactionId: string;
    expiresInSeconds: number;
    retryAfterSeconds: number;
  }> {
    const account = await this.repository.findPasswordSetupAccount(userId);
    if (!account) {
      throw new ConflictException(
        'Tài khoản đã có mật khẩu hoặc không đủ điều kiện thiết lập mật khẩu.',
      );
    }

    const email = account.email.trim().toLowerCase();
    const emailHash = hashSecretValue(email);
    const ipHash = hashSecretValue(ipAddress);
    const retryAfterSeconds = await this.repository.consumeRequestRateLimit(
      emailHash,
      ipHash,
    );
    if (retryAfterSeconds !== null) {
      throw new HttpException(
        {
          message: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng đợi trước khi thử lại.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const transactionId = await this.repository.storeOtp(
      account.id,
      emailHash,
      account.auth_version,
      hashOtp(otp, 'PASSWORD_SETUP'),
      new Date(Date.now() + OTP_TTL_MS),
      'PASSWORD_SETUP',
    );

    try {
      await this.emailService.sendOtp(email, otp, 'PASSWORD_SETUP');
    } catch {
      this.logger.error('Password setup verification email delivery failed.');
      await this.repository.invalidateOtp(
        transactionId,
        userId,
        'PASSWORD_SETUP',
      );
      throw new ServiceUnavailableException(
        'Không thể gửi mã xác minh lúc này. Vui lòng thử lại sau.',
      );
    }

    return {
      message: 'Mã xác minh đã được gửi đến email liên kết với tài khoản.',
      transactionId,
      expiresInSeconds: OTP_TTL_MS / 1000,
      retryAfterSeconds: 60,
    };
  }

  async verifyPasswordSetupOtp(
    userId: string,
    transactionId: string,
    otp: string,
  ): Promise<{ setupToken: string; expiresInSeconds: number }> {
    const account = await this.repository.findPasswordSetupAccount(userId);
    if (!account) {
      throw new BadRequestException(
        'Không thể xác minh mã cho tài khoản này. Vui lòng bắt đầu lại.',
      );
    }

    const email = account.email.trim().toLowerCase();
    const setupToken = randomBytes(32).toString('base64url');
    const verified = await this.repository.verifyOtp(
      email,
      hashSecretValue(email),
      hashOtp(otp, 'PASSWORD_SETUP'),
      hashResetToken(setupToken),
      new Date(Date.now() + RESET_TOKEN_TTL_MS),
      'PASSWORD_SETUP',
      userId,
      transactionId,
    );
    if (!verified) {
      throw new BadRequestException(
        'Mã xác minh không hợp lệ, đã hết hạn hoặc đã bị khóa.',
      );
    }
    return {
      setupToken,
      expiresInSeconds: RESET_TOKEN_TTL_MS / 1000,
    };
  }

  async completePasswordSetup(
    userId: string,
    setupToken: string,
    newPassword: string,
    currentRefreshTokenHash?: string,
  ): Promise<void> {
    if (Buffer.byteLength(newPassword, 'utf8') > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 byte.');
    }

    const account = await this.repository.findPasswordSetupAccount(userId);
    if (!account) {
      throw new BadRequestException(
        'Tài khoản đã có mật khẩu hoặc không đủ điều kiện thiết lập mật khẩu.',
      );
    }

    const email = account.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    const updated = await this.repository.completePasswordSetup(
      userId,
      email,
      hashSecretValue(email),
      hashResetToken(setupToken),
      passwordHash,
      currentRefreshTokenHash,
    );
    if (updated === null) {
      throw new BadRequestException(
        'Yêu cầu thiết lập mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng xác minh email lại.',
      );
    }
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    if (Buffer.byteLength(newPassword, 'utf8') > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 byte.');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    const reset = await this.repository.consumeResetToken(
      hashResetToken(resetToken),
      passwordHash,
    );
    if (!reset) {
      throw new BadRequestException('Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }
  }
}

function hashOtp(otp: string, purpose: PasswordChallengePurpose = 'PASSWORD_RESET'): string {
  return hashSecretValue(`${purpose.toLowerCase().replace('_', '-')}-otp:${otp}`);
}

function hashSecretValue(value: string): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
