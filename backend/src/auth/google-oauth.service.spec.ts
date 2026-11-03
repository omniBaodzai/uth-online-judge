const oidcMocks = vi.hoisted(() => ({
  discovery: vi.fn(),
  randomState: vi.fn(),
  randomNonce: vi.fn(),
  randomPKCECodeVerifier: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  authorizationCodeGrant: vi.fn(),
}));

vi.mock('openid-client', () => oidcMocks);

import * as oidc from 'openid-client';
import {
  GoogleOAuthFlowError,
  GoogleOAuthService,
} from './google-oauth.service.js';
import type { GoogleOAuthStateStore } from './google-oauth-state.store.js';

describe('GoogleOAuthService', () => {
  const configuration = {} as oidc.Configuration;
  const stateTransaction = {
    codeVerifier: 'pkce-verifier',
    nonce: 'expected-nonce',
    mode: 'register' as const,
    rememberLogin: false,
  };
  let stateStore: {
    create: ReturnType<typeof vi.fn>;
    consume: ReturnType<typeof vi.fn>;
  };
  let service: GoogleOAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'server-only-secret');
    vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:3000/auth/google/callback');
    oidcMocks.discovery.mockResolvedValue(configuration);
    oidcMocks.randomState.mockReturnValue('state-value');
    oidcMocks.randomNonce.mockReturnValue('expected-nonce');
    oidcMocks.randomPKCECodeVerifier.mockReturnValue('pkce-verifier');
    oidcMocks.calculatePKCECodeChallenge.mockResolvedValue('s256-challenge');
    oidcMocks.buildAuthorizationUrl.mockReturnValue(
      new URL('https://accounts.google.com/o/oauth2/v2/auth'),
    );
    stateStore = {
      create: vi.fn().mockResolvedValue({
        cookieName: 'uth_google_oauth_state',
        cookieValue: 'browser-binding',
      }),
      consume: vi.fn().mockResolvedValue(stateTransaction),
    };
    service = new GoogleOAuthService(stateStore as unknown as GoogleOAuthStateStore);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts OIDC authorization with state, nonce and S256 PKCE', async () => {
    const result = await service.start('register', false);

    expect(oidcMocks.discovery).toHaveBeenCalledWith(
      new URL('https://accounts.google.com'),
      'client-id',
      'server-only-secret',
    );
    expect(oidcMocks.calculatePKCECodeChallenge).toHaveBeenCalledWith('pkce-verifier');
    expect(stateStore.create).toHaveBeenCalledWith('state-value', {
      codeVerifier: 'pkce-verifier',
      nonce: 'expected-nonce',
      mode: 'register',
      rememberLogin: false,
    });
    expect(oidcMocks.buildAuthorizationUrl).toHaveBeenCalledWith(configuration, {
      redirect_uri: 'http://localhost:3000/auth/google/callback',
      scope: 'openid email profile',
      response_type: 'code',
      prompt: 'select_account',
      state: 'state-value',
      code_challenge: 's256-challenge',
      code_challenge_method: 'S256',
      nonce: 'expected-nonce',
    });
    expect(result.cookieValue).toBe('browser-binding');
  });

  it('passes the consumed state, nonce and PKCE verifier to the OIDC verifier', async () => {
    oidcMocks.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({
        sub: 'google-sub',
        email: 'student@example.com',
        email_verified: true,
        name: 'Student',
      }),
    });

    const result = await service.complete(
      '/auth/google/callback?code=google-code&state=state-value',
      'browser-binding',
    );

    expect(stateStore.consume).toHaveBeenCalledWith('state-value', 'browser-binding');
    expect(oidcMocks.authorizationCodeGrant).toHaveBeenCalledWith(
      configuration,
      new URL(
        'http://localhost:3000/auth/google/callback?code=google-code&state=state-value',
      ),
      {
        expectedState: 'state-value',
        expectedNonce: 'expected-nonce',
        pkceCodeVerifier: 'pkce-verifier',
      },
    );
    expect(result).toEqual({
      identity: {
        googleId: 'google-sub',
        email: 'student@example.com',
        emailVerified: true,
        fullName: 'Student',
      },
      mode: 'register',
      rememberLogin: false,
    });
  });

  it('rejects invalid or reused state before contacting Google', async () => {
    stateStore.consume.mockResolvedValue(null);

    await expect(service.complete(
      '/auth/google/callback?code=google-code&state=state-value',
      'wrong-browser',
    )).rejects.toMatchObject<Partial<GoogleOAuthFlowError>>({
      code: 'invalid_state',
    });
    expect(oidcMocks.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it('consumes state before handling provider cancellation', async () => {
    await expect(service.complete(
      '/auth/google/callback?error=access_denied&state=state-value',
      'browser-binding',
    )).rejects.toMatchObject<Partial<GoogleOAuthFlowError>>({
      code: 'provider_cancelled',
      mode: 'register',
    });
    expect(stateStore.consume).toHaveBeenCalledOnce();
    expect(oidcMocks.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it('rejects unverified email claims after the OIDC library validates the ID token', async () => {
    oidcMocks.authorizationCodeGrant.mockResolvedValue({
      claims: () => ({
        sub: 'google-sub',
        email: 'student@example.com',
        email_verified: false,
      }),
    });

    await expect(service.complete(
      '/auth/google/callback?code=google-code&state=state-value',
      'browser-binding',
    )).rejects.toMatchObject<Partial<GoogleOAuthFlowError>>({
      code: 'email_unverified',
    });
  });

  it('rejects duplicate state parameters and missing authorization codes', async () => {
    await expect(service.complete(
      '/auth/google/callback?code=google-code&state=one&state=two',
      'browser-binding',
    )).rejects.toMatchObject({ code: 'invalid_state' });

    await expect(service.complete(
      '/auth/google/callback?state=state-value',
      'browser-binding',
    )).rejects.toMatchObject({ code: 'invalid_callback' });
    expect(stateStore.consume).toHaveBeenCalledOnce();
  });
});
