import { ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AuthController, REFRESH_COOKIE_NAME } from '../src/auth/auth.controller.js';
import { AuthService, hashRefreshToken } from '../src/auth/auth.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { GitHubOAuthService } from '../src/auth/github-oauth.service.js';
import { GoogleOAuthService } from '../src/auth/google-oauth.service.js';
import { PasswordResetService } from '../src/auth/password-reset.service.js';
import { UsersService } from '../src/users/users.service.js';

describe('Password setup HTTP integration', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let accessToken: string;
  const userId = 'c2dc1907-45f1-4f41-9dc0-e6491bec96a1';
  const transactionId = 'bc5a8b7e-6b17-4d24-9f7d-2f43822dd0e2';
  const jwtSecret = 'test-secret-with-at-least-32-characters';
  let authVersion = 0;
  const auth = {
    getPasswordStatus: vi.fn(),
    issueAccessToken: vi.fn(),
  };
  const passwordReset = {
    requestPasswordSetupOtp: vi.fn(),
    verifyPasswordSetupOtp: vi.fn(),
    setInitialPassword: vi.fn(),
    completePasswordSetup: vi.fn(),
  };
  const users = {
    findById: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('JWT_ACCESS_SECRET', jwtSecret);
    authVersion = 0;
    auth.getPasswordStatus.mockImplementation(async () => ({
      hasPassword: authVersion > 0,
    }));
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
    passwordReset.setInitialPassword.mockImplementation(async () => {
      authVersion += 1;
    });
    passwordReset.completePasswordSetup.mockResolvedValue(undefined);
    users.findById.mockImplementation(async (id: string) => ({
      id,
      is_active: true,
      auth_version: authVersion,
      role: 'STUDENT',
    }));

    const moduleBuilder = Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: jwtSecret }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: PasswordResetService, useValue: passwordReset },
        { provide: GoogleOAuthService, useValue: {} },
        { provide: GitHubOAuthService, useValue: {} },
        { provide: UsersService, useValue: users },
        JwtStrategy,
      ],
    });
    const moduleFixture: TestingModule = await moduleBuilder.compile();

    jwt = moduleFixture.get(JwtService);
    accessToken = jwt.sign({ sub: userId, ver: 0 });
    auth.issueAccessToken.mockImplementation(async (id: string) => ({
      accessToken: jwt.sign({ sub: id, ver: authVersion }),
      expiresIn: 900,
    }));
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
    vi.unstubAllEnvs();
  });

  it('exposes password status and sends setup OTP to the JWT user without client identity fields', async () => {
    await request(app.getHttpServer())
      .get('/auth/me/password-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200, { hasPassword: false });

    await request(app.getHttpServer())
      .post('/auth/me/password-setup/otp')
      .set('Authorization', `Bearer ${accessToken}`)
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
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ transactionId, otp: '012345', userId: 'other-user' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/me/password-setup/verify-otp')
      .set('Authorization', `Bearer ${accessToken}`)
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
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=current-refresh-token`)
      .send({ setupToken: 'a'.repeat(43), newPassword: 'new-secure-password' })
      .expect(200);

    expect(response.body).toMatchObject({ expiresIn: 900 });
    expect(passwordReset.completePasswordSetup).toHaveBeenCalledWith(
      userId,
      'a'.repeat(43),
      'new-secure-password',
      hashRefreshToken('current-refresh-token'),
    );
    expect(auth.issueAccessToken).toHaveBeenCalledWith(userId);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('sets an initial password from the JWT subject and returns a fresh access token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/me/password-setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', `${REFRESH_COOKIE_NAME}=current-refresh-token`)
      .send({ newPassword: 'new-secure-password' })
      .expect(200);

    expect(response.body).toMatchObject({ expiresIn: 900 });
    expect(passwordReset.setInitialPassword).toHaveBeenCalledWith(
      userId,
      'new-secure-password',
      hashRefreshToken('current-refresh-token'),
    );
    expect(auth.issueAccessToken).toHaveBeenCalledWith(userId);
    expect(response.headers['set-cookie']).toBeUndefined();
    await request(app.getHttpServer())
      .get('/auth/me/password-status')
      .set('Authorization', `Bearer ${response.body.accessToken}`)
      .expect(200, { hasPassword: true });
  });

  it('rejects setup without a refresh cookie before calling the setup service', async () => {
    await request(app.getHttpServer())
      .post('/auth/me/password-setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPassword: 'new-secure-password' })
      .expect(401);

    expect(passwordReset.setInitialPassword).not.toHaveBeenCalled();
    expect(auth.issueAccessToken).not.toHaveBeenCalled();
  });

  it('rejects invalid passwords and client-supplied user IDs', async () => {
    await request(app.getHttpServer())
      .post('/auth/me/password-setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPassword: 'short' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/me/password-setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPassword: 'new-secure-password', userId: 'other-user' })
      .expect(400);

    expect(passwordReset.setInitialPassword).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['expired', 'expired'],
    ['invalid', 'invalid'],
  ])('rejects a %s access token for first-password setup', async (_label, tokenType) => {
    let token: string | null = accessToken;
    if (tokenType === null) token = null;
    else if (tokenType === 'expired') {
      token = jwt.sign({
        sub: userId,
        ver: 0,
        exp: Math.floor(Date.now() / 1000) - 1,
      });
    } else if (tokenType === 'invalid') token = 'not-a-valid-jwt';

    let call = request(app.getHttpServer()).post('/auth/me/password-setup');
    if (token) call = call.set('Authorization', `Bearer ${token}`);
    await call.send({ newPassword: 'new-secure-password' }).expect(401);
    expect(passwordReset.setInitialPassword).not.toHaveBeenCalled();
  });

  it('rejects a JWT for an inactive account', async () => {
    users.findById.mockResolvedValueOnce({
      id: userId,
      is_active: false,
      auth_version: 0,
      role: 'STUDENT',
    });

    await request(app.getHttpServer())
      .post('/auth/me/password-setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPassword: 'new-secure-password' })
      .expect(401);
    expect(passwordReset.setInitialPassword).not.toHaveBeenCalled();
  });
});
