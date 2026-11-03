import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AuthController } from './../src/auth/auth.controller.js';
import { AuthService } from './../src/auth/auth.service.js';
import { GitHubOAuthService } from './../src/auth/github-oauth.service.js';
import { githubOAuthStateCookieName } from './../src/auth/github-oauth-state.store.js';
import { GoogleOAuthService } from './../src/auth/google-oauth.service.js';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard.js';
import { PasswordResetService } from './../src/auth/password-reset.service.js';

describe('GitHub OAuth HTTP integration', () => {
  let app: INestApplication<App>;
  const auth = {
    loginWithGitHub: vi.fn(),
  };
  const githubOAuth = {
    start: vi.fn(),
    complete: vi.fn(),
  };

  beforeEach(async () => {
    auth.loginWithGitHub.mockReset();
    githubOAuth.start.mockReset().mockResolvedValue({
      url: 'https://github.com/login/oauth/authorize?state=opaque-state',
      cookieName: 'uth_github_oauth_state',
      cookieValue: 'browser-binding',
    });
    githubOAuth.complete.mockReset().mockResolvedValue({
      identity: {
        githubId: '123456',
        email: 'github@example.com',
        emailVerified: true,
        fullName: 'GitHub User',
      },
      mode: 'login',
      rememberLogin: false,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: GitHubOAuthService, useValue: githubOAuth },
        { provide: GoogleOAuthService, useValue: {} },
        { provide: PasswordResetService, useValue: {} },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('starts GitHub OAuth and sets the HttpOnly browser-binding cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/github?mode=login&rememberLogin=false')
      .expect(302);

    expect(githubOAuth.start).toHaveBeenCalledWith('login', false);
    expect(response.headers.location).toBe(
      'https://github.com/login/oauth/authorize?state=opaque-state',
    );
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('Path=/auth/github');
  });

  it('completes GitHub OAuth through the existing refresh-cookie session flow', async () => {
    auth.loginWithGitHub.mockResolvedValueOnce({
      user: { id: 'github-user-id' },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 900,
    });
    const state = 'opaque-state';
    const response = await request(app.getHttpServer())
      .get(`/auth/github/callback?code=one-time-code&state=${state}`)
      .set('Cookie', `${githubOAuthStateCookieName(state)}=browser-binding`)
      .expect(302);

    expect(githubOAuth.complete).toHaveBeenCalledWith(
      `/auth/github/callback?code=one-time-code&state=${state}`,
      'browser-binding',
    );
    expect(auth.loginWithGitHub).toHaveBeenCalledWith({
      githubId: '123456',
      email: 'github@example.com',
      emailVerified: true,
      fullName: 'GitHub User',
    });
    expect(response.headers.location).toBe('http://localhost:5173/');
    expect(response.headers.location).not.toContain('test-access-token');
    const cookies = response.headers['set-cookie'] as string[];
    expect(
      cookies.some(
        (cookie) =>
          cookie.startsWith('uth_refresh_token=') &&
          cookie.includes('HttpOnly'),
      ),
    ).toBe(true);
    expect(
      cookies.some((cookie) => cookie.startsWith('uth_remember_login=0')),
    ).toBe(true);
  });
});
