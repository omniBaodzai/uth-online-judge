import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from './login.dto.js';
import { ProfileUpdateDto } from './profile-update.dto.js';
import { RegisterDto } from './register.dto.js';
import { CoverCropMetadataDto, CoverUploadDto } from './cover-upload.dto.js';
import { ChangePasswordDto } from './change-password.dto.js';
import { ForgotPasswordDto } from './forgot-password.dto.js';
import { VerifyResetOtpDto } from './verify-reset-otp.dto.js';
import { ResetPasswordDto } from './reset-password.dto.js';
import { VerifyPasswordSetupOtpDto } from './verify-password-setup-otp.dto.js';
import { CompletePasswordSetupDto } from './complete-password-setup.dto.js';

describe('authentication DTO validation', () => {
  it('validates password-reset email, OTP, and reset-token payloads', () => {
    expect(validateSync(plainToInstance(ForgotPasswordDto, {
      email: 'student@example.com',
    }))).toHaveLength(0);
    expect(validateSync(plainToInstance(VerifyResetOtpDto, {
      email: 'student@example.com',
      otp: '012345',
    }))).toHaveLength(0);
    expect(validateSync(plainToInstance(VerifyResetOtpDto, {
      email: 'student@example.com',
      otp: '12345x',
    })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(ResetPasswordDto, {
      resetToken: 'a'.repeat(43),
      newPassword: 'a-secure-password',
    }))).toHaveLength(0);
    expect(validateSync(plainToInstance(ResetPasswordDto, {
      resetToken: 'short',
      newPassword: 'short',
    })).length).toBeGreaterThan(0);
  });

  it('validates the setup transaction OTP and one-time setup token', () => {
    const otp = plainToInstance(VerifyPasswordSetupOtpDto, {
      transactionId: '00000000-0000-4000-8000-000000000001',
      otp: '012345',
    });
    expect(validateSync(otp, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);

    const invalidOtp = plainToInstance(VerifyPasswordSetupOtpDto, {
      transactionId: 'not-a-uuid',
      otp: '12345x',
      userId: 'attacker-chosen-id',
    });
    expect(validateSync(invalidOtp, { whitelist: true, forbidNonWhitelisted: true }).length)
      .toBeGreaterThanOrEqual(2);

    const complete = plainToInstance(CompletePasswordSetupDto, {
      setupToken: 'a'.repeat(43),
      newPassword: 'a-secure-password',
    });
    expect(validateSync(complete, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });

  it('accepts a valid email, username, and password', () => {
    const dto = plainToInstance(RegisterDto, {
      username: 'student_01',
      email: 'student@example.com',
      password: 'long-enough-password',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects short usernames, malformed emails, short passwords, and @ usernames', () => {
    const dto = plainToInstance(RegisterDto, {
      username: 'student@example.com',
      email: 'not-an-email',
      password: 'short',
    });

    expect(validateSync(dto).length).toBeGreaterThanOrEqual(3);
  });

  it('accepts either username or email as a login identifier', () => {
    for (const identifier of ['student01', 'student@example.com']) {
      const dto = plainToInstance(LoginDto, { identifier, password: 'password' });
      expect(validateSync(dto)).toHaveLength(0);
    }
  });

  it('requires a current password and a new password following registration policy', () => {
    const valid = plainToInstance(ChangePasswordDto, {
      currentPassword: 'current-password',
      newPassword: 'new-password',
    });
    expect(validateSync(valid, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);

    const invalid = plainToInstance(ChangePasswordDto, {
      currentPassword: '',
      newPassword: 'short',
    });
    expect(validateSync(invalid, { whitelist: true, forbidNonWhitelisted: true }).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('validates profile update fields', () => {
    const valid = plainToInstance(ProfileUpdateDto, {
      fullName: 'Student Name',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(validateSync(valid)).toHaveLength(0);

    const invalid = plainToInstance(ProfileUpdateDto, {
      avatarUrl: 'javascript:alert(1)',
    });
    expect(validateSync(invalid).length).toBeGreaterThan(0);
  });

  it('validates multipart crop JSON as a nested DTO with whitelist enabled', () => {
    const crop = {
      x: 0,
      y: 120,
      width: 1600,
      height: 500,
      sourceWidth: 1600,
      sourceHeight: 900,
      aspect: 3.2,
    };
    const dto = plainToInstance(CoverUploadDto, { crop: JSON.stringify(crop) });

    expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    expect(dto.crop).toBeInstanceOf(CoverCropMetadataDto);
    expect(dto.crop).toMatchObject(crop);
    expect(validateSync(plainToInstance(CoverUploadDto, {
      crop: JSON.stringify({ ...crop, unexpected: true }),
    }), { whitelist: true, forbidNonWhitelisted: true }).length).toBeGreaterThan(0);
  });
});
