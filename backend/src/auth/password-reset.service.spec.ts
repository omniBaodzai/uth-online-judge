import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordResetService } from './password-reset.service.js';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
}));

describe('PasswordResetService', () => {
  const originalSecret = process.env.JWT_ACCESS_SECRET;
  const account = { id: 'user-id', email: 'user@example.com', auth_version: 0 };
  let repository: {
    consumeRequestRateLimit: ReturnType<typeof vi.fn>;
    findEligibleAccount: ReturnType<typeof vi.fn>;
    storeOtp: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
    consumeResetToken: ReturnType<typeof vi.fn>;
  };
  let email: { sendOtp: ReturnType<typeof vi.fn> };
  let service: PasswordResetService;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret-with-at-least-32-characters';
    vi.clearAllMocks();
    repository = {
      consumeRequestRateLimit: vi.fn().mockResolvedValue(null),
      findEligibleAccount: vi.fn().mockResolvedValue(null),
      storeOtp: vi.fn().mockResolvedValue(undefined),
      verifyOtp: vi.fn().mockResolvedValue(true),
      consumeResetToken: vi.fn().mockResolvedValue(true),
    };
    email = { sendOtp: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(bcrypt.hash).mockResolvedValue('new-password-hash');
    service = new PasswordResetService(repository as never, email as never);
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalSecret;
  });

  it('returns the same generic message for an unknown, inactive, or OAuth-only account', async () => {
    const response = await service.requestOtp(' Missing@Example.com ', '192.0.2.1');

    expect(response.message).toContain('Nếu email thuộc tài khoản');
    expect(repository.findEligibleAccount).toHaveBeenCalledWith('missing@example.com');
    expect(email.sendOtp).not.toHaveBeenCalled();
    expect(repository.storeOtp).not.toHaveBeenCalled();
  });

  it('sends a six-digit OTP and stores only a keyed hash for an eligible account', async () => {
    repository.findEligibleAccount.mockResolvedValue(account);

    const response = await service.requestOtp(account.email, '192.0.2.2');

    const [recipient, otp] = email.sendOtp.mock.calls[0] as [string, string];
    expect(recipient).toBe(account.email);
    expect(otp).toMatch(/^\d{6}$/);
    expect(repository.storeOtp).toHaveBeenCalledWith(
      account.id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      account.auth_version,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(repository.storeOtp.mock.calls[0]?.[3]).not.toBe(otp);
    expect(response.retryAfterSeconds).toBe(60);
  });

  it('does not replace a previous OTP when email delivery fails', async () => {
    repository.findEligibleAccount.mockResolvedValue(account);
    email.sendOtp.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.requestOtp(account.email, '192.0.2.3'))
      .resolves.toMatchObject({ retryAfterSeconds: 60 });
    expect(repository.storeOtp).not.toHaveBeenCalled();
  });

  it('rejects rate-limited requests before looking up an account', async () => {
    repository.consumeRequestRateLimit.mockResolvedValue(45);

    await expect(service.requestOtp(account.email, '192.0.2.4'))
      .rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: expect.objectContaining({ retryAfterSeconds: 45 }),
      } satisfies Partial<HttpException>);
    expect(repository.findEligibleAccount).not.toHaveBeenCalled();
    expect(email.sendOtp).not.toHaveBeenCalled();
  });

  it('exchanges a valid OTP for a short-lived reset token without exposing its hash', async () => {
    const result = await service.verifyOtp(' USER@example.com ', '012345');

    expect(result.resetToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.verifyOtp).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(repository.verifyOtp.mock.calls[0]?.[2]).not.toBe('012345');
    expect(repository.verifyOtp.mock.calls[0]?.[3]).not.toBe(result.resetToken);
  });

  it('rejects incorrect or expired OTPs and reset tokens', async () => {
    repository.verifyOtp.mockResolvedValue(false);
    await expect(service.verifyOtp(account.email, '999999'))
      .rejects.toBeInstanceOf(BadRequestException);

    repository.consumeResetToken.mockResolvedValue(false);
    await expect(service.resetPassword('a'.repeat(43), 'new-password'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('hashes a valid new password and consumes the reset token through the repository', async () => {
    await service.resetPassword('a'.repeat(43), 'new-secure-password');

    expect(bcrypt.hash).toHaveBeenCalledWith('new-secure-password', 12);
    expect(repository.consumeResetToken).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'new-password-hash',
    );
    expect(repository.consumeResetToken.mock.calls[0]?.[0]).not.toBe('a'.repeat(43));
  });

  it('enforces bcrypt byte limits before hashing', async () => {
    await expect(service.resetPassword('a'.repeat(43), 'é'.repeat(37)))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });
});
