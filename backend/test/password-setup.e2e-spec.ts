import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AuthController, REFRESH_COOKIE_NAME } from '../src/auth/auth.controller.js';
import { AuthService, hashRefreshToken } from '../src/auth/auth.service.js';
import { GitHubOAuthService } from '../src/auth/github-oauth.service.js';
import { GoogleOAuthService } from '../src/auth/google-oauth.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PasswordResetService } from '../src/auth/password-reset.service.js';

describe('Password setup HTTP integration', () => {
  let app: INestApplication<App>;
  const userId = 'c2dc1907-45f1-4f41-9dc0-e6491bec96a1';
  const transactionId = 'bc5a8b7e-6b17-4d24-9f7d-2f43822dd0e2';
  const auth = {
    getPasswordStatus: vi.fn(),
    issueAccessToken: vi.fn(),
  };
  const passwordReset = {
    requestPasswordSetupOtp: vi.fn(),
    verifyPasswordSetupOtp: vi.fn(),
    completePasswordSetup: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    auth.getPasswordStatus.mockResolvedValue({ hasPassword: false });
    auth.issueAccessToken.mockResolvedValue({
      accessToken: 'fresh-access-token',
      expiresIn: 900,
    });
    passwordReset.requestPasswordSetupOtp.mockResolvedValue({
      message: 'sent',
      transactionId,
      expiresInSeconds: 300,
      retryAfterSeconds: 60,
    });
    passwordReset.verifyPasswordSetupOtp.mockResolvedValue({
      setupToken: 'a'.repeat(43),
      expiresInSeconds: 600,
    });
    passwordReset.completePasswordSetup.mockResolvedValue(undefined);

    const moduleBuilder = Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: PasswordResetService, useValue: passwordReset },
        { provide: GoogleOAuthService, useValue: {} },
        { provide: GitHubOAuthService, useValue: {} },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({
          canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
            context.switchToHttp().getRequest().user = { id: userId, role: 'STUDENT' };
            return true;
          },
        });
    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('exposes password status and sends setup OTP to the JWT user without client identity fields', async () => {
    await request(app.getHttpServer())
      .get('/auth/me/password-status')
      .expect(200, { hasPassword: false });

    await request(app.getHttpServer())
      .post('/auth/me/password-setup/otp')
      .expect(202)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          transactionId,
          expiresInSeconds: 300,
          retryAfterSeconds: 60,
        });
      });

    expect(auth.getPasswordStatus).toHaveBeenCalledWith(userId);
    expect(passwordReset.requestPasswordSetupOtp).toHaveBeenCalledWith(
      userId,
      expect.any(String),
    );
  });

  it('validates OTP transaction payloads and rejects client-supplied account identity', async () => {
    await request(app.getHttpServer())
      .post('/auth/me/password-setup/verify-otp')
      .send({ transactionId, otp: '012345', userId: 'other-user' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/me/password-setup/verify-otp')
      .send({ transactionId, otp: '012345' })
      .expect(200, {
        setupToken: 'a'.repeat(43),
        expiresInSeconds: 600,
      });

    expect(passwordReset.verifyPasswordSetupOtp).toHaveBeenCalledWith(
      userId,
      transactionId,
      '012345',
    );
  });

  it('completes setup with a one-time grant and returns a fresh access token only', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/me/password-setup/complete')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=current-refresh-token`)
      .send({ setupToken: 'a'.repeat(43), newPassword: 'new-secure-password' })
      .expect(200, {
        accessToken: 'fresh-access-token',
        expiresIn: 900,
      });

    expect(passwordReset.completePasswordSetup).toHaveBeenCalledWith(
      userId,
      'a'.repeat(43),
      'new-secure-password',
      hashRefreshToken('current-refresh-token'),
    );
    expect(auth.issueAccessToken).toHaveBeenCalledWith(userId);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
