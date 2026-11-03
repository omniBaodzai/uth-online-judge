import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import {
  AuthController,
  REFRESH_COOKIE_NAME,
} from './auth.controller.js';
import { hashRefreshToken } from './auth.service.js';
import { PublicProfileController } from '../users/public-profile.controller.js';
import { googleOAuthStateCookieName } from './google-oauth-state.store.js';
import { githubOAuthStateCookieName } from './github-oauth-state.store.js';

function guardsOf(prototype: object, methodName: string): unknown[] {
  const method = Object.getOwnPropertyDescriptor(prototype, methodName)?.value;
  return Reflect.getMetadata('__guards__', method) ?? [];
}

describe('cover upload authorization', () => {
  it('requires authentication and uses the caller ID instead of accepting an owner ID', async () => {
    const auth = { uploadCover: vi.fn().mockResolvedValue({ id: 'owner' }) };
    const controller = new AuthController(
      auth as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const request = { user: { id: 'owner', role: 'STUDENT' } } as never;
    const crop = {
      x: 0,
      y: 0,
      width: 1280,
      height: 400,
      sourceWidth: 1280,
      sourceHeight: 400,
      aspect: 3.2,
    };

    const guards = guardsOf(AuthController.prototype, 'uploadCover');
    expect(guards).toContain(JwtAuthGuard);
    await controller.uploadCover(
      request,
      { buffer: Buffer.from('cover') } as never,
      { crop } as never,
    );
    expect(auth.uploadCover).toHaveBeenCalledWith(
      'owner',
      Buffer.from('cover'),
      crop,
    );
  });

  describe('change password authorization', () => {
    it('requires authentication and scopes the operation to the JWT user', async () => {
      const auth = { changePassword: vi.fn().mockResolvedValue(undefined) };
      const controller = new AuthController(
        auth as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const request = {
        user: { id: 'owner', role: 'STUDENT' },
        headers: {
          cookie: `${REFRESH_COOKIE_NAME}=refresh-token; other=value`,
        },
      } as never;
      const guards = guardsOf(AuthController.prototype, 'changePassword');

      expect(guards).toContain(JwtAuthGuard);
      await controller.changePassword(request, {
        currentPassword: 'current-password',
        newPassword: 'new-password',
      } as never);
      expect(auth.changePassword).toHaveBeenCalledWith(
        'owner',
        'current-password',
        'new-password',
        'refresh-token',
      );
    });
  });

  it('requires authentication and scopes profile updates to the JWT subject', async () => {
    const auth = { updateProfile: vi.fn().mockResolvedValue({ id: 'owner' }) };
    const controller = new AuthController(
      auth as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const request = { user: { id: 'owner', role: 'STUDENT' } } as never;
    const guards = guardsOf(AuthController.prototype, 'updateMe');

    expect(guards).toContain(JwtAuthGuard);
    await controller.updateMe(request, { bio: 'About me' } as never);
    expect(auth.updateProfile).toHaveBeenCalledWith('owner', {
      bio: 'About me',
    });
  });
});

describe('password reset endpoints', () => {
  it('keeps the forgot-password response public and applies the request IP rate key', async () => {
    const passwordReset = {
      requestOtp: vi
        .fn()
        .mockResolvedValue({ message: 'generic', retryAfterSeconds: 60 }),
    };
    const controller = new AuthController(
      {} as never,
      passwordReset as never,
      {} as never,
      {} as never,
    );
    const request = {
      ip: '192.0.2.10',
      socket: { remoteAddress: '192.0.2.11' },
    } as never;

    expect(guardsOf(AuthController.prototype, 'forgotPassword')).toEqual([]);
    await expect(
      controller.forgotPassword(
        { email: 'user@example.com' } as never,
        request,
      ),
    ).resolves.toMatchObject({ retryAfterSeconds: 60 });
    expect(passwordReset.requestOtp).toHaveBeenCalledWith(
      'user@example.com',
      '192.0.2.10',
    );
  });

  it('verifies OTP and clears browser refresh cookies after password reset', async () => {
    const passwordReset = {
      verifyOtp: vi.fn().mockResolvedValue({ resetToken: 'one-time-token' }),
      resetPassword: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new AuthController(
      {} as never,
      passwordReset as never,
      {} as never,
      {} as never,
    );
    const response = { clearCookie: vi.fn() } as never;

    await expect(
      controller.verifyResetOtp({
        email: 'user@example.com',
        otp: '012345',
      } as never),
    ).resolves.toEqual({ resetToken: 'one-time-token' });
    await controller.resetPassword(
      {
        resetToken: 'a'.repeat(43),
        newPassword: 'new-secure-password',
      } as never,
      response,
    );

    expect(passwordReset.verifyOtp).toHaveBeenCalledWith(
      'user@example.com',
      '012345',
    );
    expect(passwordReset.resetPassword).toHaveBeenCalledWith(
      'a'.repeat(43),
      'new-secure-password',
    );
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });
});

describe('password setup endpoints', () => {
  it('requires JWT authentication and always targets the JWT subject', async () => {
    const auth = {
      getPasswordStatus: vi.fn().mockResolvedValue({ hasPassword: false }),
      issueAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'fresh-access-token',
        expiresIn: 900,
      }),
    };
    const passwordReset = {
      requestPasswordSetupOtp: vi.fn().mockResolvedValue({
        transactionId: 'transaction-id',
      }),
      verifyPasswordSetupOtp: vi.fn().mockResolvedValue({ setupToken: 'setup-token' }),
      completePasswordSetup: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new AuthController(
      auth as never,
      passwordReset as never,
      {} as never,
      {} as never,
    );
    const request = {
      user: { id: 'jwt-user-id', role: 'STUDENT' },
      ip: '192.0.2.20',
      socket: { remoteAddress: '192.0.2.21' },
      headers: { cookie: `${REFRESH_COOKIE_NAME}=current-refresh-token` },
    } as never;

    for (const method of [
      'getPasswordStatus',
      'requestPasswordSetupOtp',
      'verifyPasswordSetupOtp',
      'completePasswordSetup',
    ]) {
      expect(guardsOf(AuthController.prototype, method)).toContain(JwtAuthGuard);
    }

    await expect(controller.getPasswordStatus(request))
      .resolves.toEqual({ hasPassword: false });
    await controller.requestPasswordSetupOtp(request);
    await controller.verifyPasswordSetupOtp(request, {
      transactionId: 'transaction-id',
      otp: '012345',
    } as never);
    await expect(controller.completePasswordSetup(request, {
      setupToken: 'a'.repeat(43),
      newPassword: 'new-secure-password',
    } as never)).resolves.toEqual({
      accessToken: 'fresh-access-token',
      expiresIn: 900,
    });

    expect(auth.getPasswordStatus).toHaveBeenCalledWith('jwt-user-id');
    expect(passwordReset.requestPasswordSetupOtp).toHaveBeenCalledWith(
      'jwt-user-id',
      '192.0.2.20',
    );
    expect(passwordReset.verifyPasswordSetupOtp).toHaveBeenCalledWith(
      'jwt-user-id',
      'transaction-id',
      '012345',
    );
    expect(passwordReset.completePasswordSetup).toHaveBeenCalledWith(
      'jwt-user-id',
      'a'.repeat(43),
      'new-secure-password',
      hashRefreshToken('current-refresh-token'),
    );
    expect(auth.issueAccessToken).toHaveBeenCalledWith('jwt-user-id');
  });
});

describe('Google OAuth endpoints', () => {
  beforeEach(() => {
    vi.stubEnv('FRONTEND_URL', 'http://localhost:5173');
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts the authorization redirect with an HttpOnly browser-binding cookie', async () => {
    const googleOAuth = {
      start: vi.fn().mockResolvedValue({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?state=opaque&code_challenge=challenge',
        cookieName: 'uth_google_oauth_state',
        cookieValue: 'browser-binding',
      }),
    };
    const controller = new AuthController(
      {} as never,
      {} as never,
      googleOAuth as never,
      {} as never,
    );
    const response = { cookie: vi.fn(), redirect: vi.fn() };

    await controller.startGoogleOAuth('login', 'false', response as never);

    expect(googleOAuth.start).toHaveBeenCalledWith('login', false);
    expect(response.cookie).toHaveBeenCalledWith(
      'uth_google_oauth_state',
      'browser-binding',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/auth/google',
      }),
    );
    expect(response.redirect).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?state=opaque&code_challenge=challenge',
    );
  });

  it('establishes the existing refresh-cookie session and redirects without tokens in the URL', async () => {
    const state = 'opaque-state';
    const googleOAuth = {
      complete: vi.fn().mockResolvedValue({
        identity: {
          googleId: 'google-sub',
          email: 'user@example.com',
          emailVerified: true,
          fullName: 'Google User',
        },
        mode: 'register',
        rememberLogin: true,
      }),
    };
    const auth = {
      loginWithGoogle: vi.fn().mockResolvedValue({
        user: { id: 'user-id' },
        accessToken: 'internal-access-token',
        refreshToken: 'internal-refresh-token',
        expiresIn: 900,
      }),
    };
    const controller = new AuthController(
      auth as never,
      {} as never,
      googleOAuth as never,
      {} as never,
    );
    const response = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    };
    const request = {
      originalUrl: `/auth/google/callback?code=google-code&state=${state}`,
      headers: {
        cookie: `${googleOAuthStateCookieName(state)}=browser-binding`,
      },
    } as never;

    await controller.completeGoogleOAuth(request, response as never);

    expect(googleOAuth.complete).toHaveBeenCalledWith(
      request.originalUrl,
      'browser-binding',
    );
    expect(auth.loginWithGoogle).toHaveBeenCalledWith({
      googleId: 'google-sub',
      email: 'user@example.com',
      emailVerified: true,
      fullName: 'Google User',
    });
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'internal-refresh-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/auth',
        maxAge: expect.any(Number),
      }),
    );
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:5173/');
    expect(response.redirect.mock.calls[0]?.[0]).not.toContain(
      'internal-access-token',
    );
    expect(response.redirect.mock.calls[0]?.[0]).not.toContain(
      'internal-refresh-token',
    );
  });

  it('shows a safe account-conflict message and never links accounts by email', async () => {
    const state = 'conflict-state';
    const googleOAuth = {
      complete: vi.fn().mockResolvedValue({
        identity: {
          googleId: 'google-sub',
          email: 'existing@example.com',
          emailVerified: true,
          fullName: null,
        },
        mode: 'login',
        rememberLogin: true,
      }),
    };
    const auth = {
      loginWithGoogle: vi
        .fn()
        .mockRejectedValue(
          new ConflictException('Email Google này đã có tài khoản.'),
        ),
    };
    const controller = new AuthController(
      auth as never,
      {} as never,
      googleOAuth as never,
      {} as never,
    );
    const response = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    };
    const request = {
      originalUrl: `/auth/google/callback?code=google-code&state=${state}`,
      headers: { cookie: `${googleOAuthStateCookieName(state)}=binding` },
    } as never;

    await controller.completeGoogleOAuth(request, response as never);

    expect(response.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/login?oauthError=account_exists',
    );
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('passes the callback refresh cookie into the current refresh rotation flow', async () => {
    const auth = {
      refresh: vi.fn().mockResolvedValue({
        user: { id: 'user-id' },
        accessToken: 'next-access-token',
        refreshToken: 'rotated-refresh-token',
        expiresIn: 900,
      }),
    };
    const controller = new AuthController(
      auth as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const response = { cookie: vi.fn() };

    await controller.refresh(
      {
        headers: {
          cookie: `${REFRESH_COOKIE_NAME}=callback-refresh-token; uth_remember_login=1`,
        },
      } as never,
      response as never,
    );

    expect(auth.refresh).toHaveBeenCalledWith('callback-refresh-token');
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'rotated-refresh-token',
      expect.objectContaining({ httpOnly: true, path: '/auth' }),
    );
  });
});

describe('GitHub OAuth endpoints', () => {
  beforeEach(() => {
    vi.stubEnv('FRONTEND_URL', 'http://localhost:5173');
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts GitHub authorization with an isolated HttpOnly browser-binding cookie', async () => {
    const githubOAuth = {
      start: vi.fn().mockResolvedValue({
        url: 'https://github.com/login/oauth/authorize?state=opaque&scope=read%3Auser+user%3Aemail&code_challenge=challenge',
        cookieName: 'uth_github_oauth_state',
        cookieValue: 'browser-binding',
      }),
    };
    const controller = new AuthController(
      {} as never,
      {} as never,
      {} as never,
      githubOAuth as never,
    );
    const response = { cookie: vi.fn(), redirect: vi.fn() };

    await controller.startGitHubOAuth('register', 'false', response as never);

    expect(githubOAuth.start).toHaveBeenCalledWith('register', true);
    expect(response.cookie).toHaveBeenCalledWith(
      'uth_github_oauth_state',
      'browser-binding',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/auth/github',
      }),
    );
    expect(response.redirect).toHaveBeenCalledWith(
      'https://github.com/login/oauth/authorize?state=opaque&scope=read%3Auser+user%3Aemail&code_challenge=challenge',
    );
  });

  it('uses the existing refresh-cookie session and never redirects with tokens', async () => {
    const state = 'opaque-github-state';
    const githubOAuth = {
      complete: vi.fn().mockResolvedValue({
        identity: {
          githubId: '123456',
          email: 'user@example.com',
          emailVerified: true,
          fullName: 'GitHub User',
        },
        mode: 'register',
        rememberLogin: false,
      }),
    };
    const auth = {
      loginWithGitHub: vi.fn().mockResolvedValue({
        user: { id: 'user-id' },
        accessToken: 'internal-access-token',
        refreshToken: 'internal-refresh-token',
        expiresIn: 900,
      }),
    };
    const controller = new AuthController(
      auth as never,
      {} as never,
      {} as never,
      githubOAuth as never,
    );
    const response = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    };
    const request = {
      originalUrl: `/auth/github/callback?code=github-code&state=${state}`,
      headers: {
        cookie: `${githubOAuthStateCookieName(state)}=browser-binding`,
      },
    } as never;

    await controller.completeGitHubOAuth(request, response as never);

    expect(githubOAuth.complete).toHaveBeenCalledWith(
      request.originalUrl,
      'browser-binding',
    );
    expect(auth.loginWithGitHub).toHaveBeenCalledWith({
      githubId: '123456',
      email: 'user@example.com',
      emailVerified: true,
      fullName: 'GitHub User',
    });
    expect(response.clearCookie).toHaveBeenCalledWith(
      githubOAuthStateCookieName(state),
      expect.objectContaining({ path: '/auth/github' }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'internal-refresh-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/auth',
      }),
    );
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:5173/');
    expect(response.redirect.mock.calls[0]?.[0]).not.toContain(
      'internal-access-token',
    );
    expect(response.redirect.mock.calls[0]?.[0]).not.toContain(
      'internal-refresh-token',
    );
  });

  it('returns a provider-specific safe error and does not issue a session on email conflict', async () => {
    const githubOAuth = {
      complete: vi.fn().mockResolvedValue({
        identity: {
          githubId: '123456',
          email: 'existing@example.com',
          emailVerified: true,
          fullName: null,
        },
        mode: 'login',
        rememberLogin: true,
      }),
    };
    const auth = {
      loginWithGitHub: vi
        .fn()
        .mockRejectedValue(
          new ConflictException('GitHub email belongs to an existing account.'),
        ),
    };
    const controller = new AuthController(
      auth as never,
      {} as never,
      {} as never,
      githubOAuth as never,
    );
    const response = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    };
    const request = {
      originalUrl: '/auth/github/callback?code=code&state=state-value',
      headers: {
        cookie: `${githubOAuthStateCookieName('state-value')}=binding`,
      },
    } as never;

    await controller.completeGitHubOAuth(request, response as never);

    expect(response.cookie).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/login?oauthError=account_exists&oauthProvider=github',
    );
  });
});

describe('public profile access', () => {
  it('does not require authentication for username and id lookups', async () => {
    const profiles = {
      getByUsername: vi.fn().mockResolvedValue({ user: { username: 'coder' } }),
      getById: vi.fn().mockResolvedValue({ user: { id: 'coder-id' } }),
    };
    const controller = new PublicProfileController(profiles as never);

    expect(
      guardsOf(PublicProfileController.prototype, 'getByUsername'),
    ).toEqual([]);
    expect(guardsOf(PublicProfileController.prototype, 'getById')).toEqual([]);
    await expect(controller.getByUsername('coder')).resolves.toEqual({
      user: { username: 'coder' },
    });
    await expect(controller.getById('coder-id')).resolves.toEqual({
      user: { id: 'coder-id' },
    });
  });
});
