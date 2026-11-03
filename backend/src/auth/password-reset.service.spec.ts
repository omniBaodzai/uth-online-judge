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
    findPasswordSetupAccount: ReturnType<typeof vi.fn>;
    storeOtp: ReturnType<typeof vi.fn>;
    invalidateOtp: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
    consumeResetToken: ReturnType<typeof vi.fn>;
    completePasswordSetup: ReturnType<typeof vi.fn>;
  };
  let email: { sendOtp: ReturnType<typeof vi.fn> };
  let service: PasswordResetService;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret-with-at-least-32-characters';
    vi.clearAllMocks();
    repository = {
      consumeRequestRateLimit: vi.fn().mockResolvedValue(null),
      findEligibleAccount: vi.fn().mockResolvedValue(null),
      findPasswordSetupAccount: vi.fn().mockResolvedValue(null),
      storeOtp: vi.fn().mockResolvedValue('transaction-id'),
      invalidateOtp: vi.fn().mockResolvedValue(undefined),
      verifyOtp: vi.fn().mockResolvedValue(true),
      consumeResetToken: vi.fn().mockResolvedValue(true),
      completePasswordSetup: vi.fn().mockResolvedValue(1),
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
      'PASSWORD_RESET',
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

  it('creates a password-setup OTP only for the authenticated OAuth account email', async () => {
    repository.findPasswordSetupAccount.mockResolvedValue(account);

    const response = await service.requestPasswordSetupOtp('user-id', '192.0.2.5');

    expect(repository.findPasswordSetupAccount).toHaveBeenCalledWith('user-id');
    expect(repository.storeOtp).toHaveBeenCalledWith(
      account.id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      account.auth_version,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
      'PASSWORD_SETUP',
    );
    const [recipient, otp, purpose] = email.sendOtp.mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(recipient).toBe(account.email);
    expect(otp).toMatch(/^\d{6}$/);
    expect(purpose).toBe('PASSWORD_SETUP');
    expect(response).toMatchObject({
      transactionId: 'transaction-id',
      expiresInSeconds: 300,
      retryAfterSeconds: 60,
    });
  });

  it('invalidates a setup challenge if Resend fails', async () => {
    repository.findPasswordSetupAccount.mockResolvedValue(account);
    email.sendOtp.mockRejectedValue(new Error('provider unavailable'));

    await expect(service.requestPasswordSetupOtp('user-id', '192.0.2.6'))
      .rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    expect(repository.invalidateOtp).toHaveBeenCalledWith(
      'transaction-id',
      'user-id',
      'PASSWORD_SETUP',
    );
  });

  it('binds setup OTP verification to user and transaction and hashes its one-time token', async () => {
    repository.findPasswordSetupAccount.mockResolvedValue(account);

    const result = await service.verifyPasswordSetupOtp(
      'user-id',
      'transaction-id',
      '012345',
    );

    expect(result.setupToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.verifyOtp).toHaveBeenCalledWith(
      account.email,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
      'PASSWORD_SETUP',
      'user-id',
      'transaction-id',
    );
    expect(repository.verifyOtp.mock.calls[0]?.[2]).not.toBe('012345');
    expect(repository.verifyOtp.mock.calls[0]?.[3]).not.toBe(result.setupToken);
  });

  it('uses distinct keyed OTP hashes for reset and setup purposes', async () => {
    repository.findPasswordSetupAccount.mockResolvedValue(account);
    await service.verifyOtp(account.email, '012345');
    const resetHash = repository.verifyOtp.mock.calls[0]?.[2];
    repository.verifyOtp.mockClear();

    await service.verifyPasswordSetupOtp('user-id', 'transaction-id', '012345');
    const setupHash = repository.verifyOtp.mock.calls[0]?.[2];

    expect(resetHash).not.toBe(setupHash);
  });

  it('uses the same purpose-specific hash when storing and verifying each OTP', async () => {
    let sentOtp = '';
    email.sendOtp.mockImplementation(async (_recipient: string, otp: string) => {
      sentOtp = otp;
    });
    repository.findEligibleAccount.mockResolvedValue(account);

    await service.requestOtp(account.email, '192.0.2.8');
    const resetStoredHash = repository.storeOtp.mock.calls[0]?.[3];
    await service.verifyOtp(account.email, sentOtp);
    expect(repository.verifyOtp.mock.calls[0]?.[2]).toBe(resetStoredHash);
    expect(repository.verifyOtp.mock.calls[0]?.[5]).toBe('PASSWORD_RESET');

    repository.findPasswordSetupAccount.mockResolvedValue(account);
    repository.verifyOtp.mockClear();
    await service.requestPasswordSetupOtp('user-id', '192.0.2.9');
    const setupStoredHash = repository.storeOtp.mock.calls[1]?.[3];
    await service.verifyPasswordSetupOtp('user-id', 'transaction-id', sentOtp);

    expect(repository.verifyOtp.mock.calls[0]?.[2]).toBe(setupStoredHash);
    expect(repository.verifyOtp.mock.calls[0]?.[5]).toBe('PASSWORD_SETUP');
  });

  it('hashes the password and asks the repository to atomically consume setup grant', async () => {
    repository.findPasswordSetupAccount.mockResolvedValue(account);

    await service.completePasswordSetup(
      'user-id',
      'a'.repeat(43),
      'new-secure-password',
      'current-refresh-hash',
    );

    expect(bcrypt.hash).toHaveBeenCalledWith('new-secure-password', 12);
    expect(repository.completePasswordSetup).toHaveBeenCalledWith(
      'user-id',
      account.email,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'new-password-hash',
      'current-refresh-hash',
    );
  });

  it('rejects setup requests for accounts with no eligible OAuth-only state', async () => {
    await expect(service.requestPasswordSetupOtp('user-id', '192.0.2.7'))
      .rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    expect(email.sendOtp).not.toHaveBeenCalled();
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
      'PASSWORD_RESET',
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
