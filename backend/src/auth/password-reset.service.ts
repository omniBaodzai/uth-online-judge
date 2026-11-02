import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PasswordResetEmailService } from './password-reset-email.service.js';
import { PasswordResetRepository } from './password-reset.repository.js';

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
        hashOtp(otp),
        new Date(Date.now() + OTP_TTL_MS),
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
      hashOtp(otp),
      hashResetToken(resetToken),
      new Date(Date.now() + RESET_TOKEN_TTL_MS),
    );
    if (!verified) {
      throw new BadRequestException('Mã xác nhận không hợp lệ, đã hết hạn hoặc đã bị khóa.');
    }
    return { resetToken };
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

function hashSecretValue(value: string): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

function hashOtp(otp: string): string {
  return hashSecretValue(`password-reset-otp:${otp}`);
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
