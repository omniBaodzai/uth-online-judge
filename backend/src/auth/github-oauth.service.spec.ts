import { createHash } from 'node:crypto';
import {
  GitHubOAuthFlowError,
  GitHubOAuthService,
} from './github-oauth.service.js';
import type { GitHubOAuthStateStore } from './github-oauth-state.store.js';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('GitHubOAuthService', () => {
  const transaction = {
    codeVerifier: 'transaction-code-verifier',
    mode: 'register' as const,
    rememberLogin: false,
  };
  let states: {
    create: ReturnType<typeof vi.fn>;
    consume: ReturnType<typeof vi.fn>;
  };
  let fetchFn: ReturnType<typeof vi.fn>;
  let service: GitHubOAuthService;

  beforeEach(() => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'github-client-id');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'server-only-github-secret');
    vi.stubEnv(
      'GITHUB_REDIRECT_URI',
      'http://localhost:3000/auth/github/callback',
    );
    states = {
      create: vi.fn().mockResolvedValue({
        cookieName: 'uth_github_oauth_state',
        cookieValue: 'browser-binding',
      }),
      consume: vi.fn().mockResolvedValue(transaction),
    };
    fetchFn = vi.fn();
    service = new GitHubOAuthService(
      states as unknown as GitHubOAuthStateStore,
      fetchFn as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts GitHub authorization with minimum scopes, state, browser binding and S256 PKCE', async () => {
    const result = await service.start('register', false);
    const authorization = new URL(result.url);
    const [state, storedTransaction] = states.create.mock.calls[0] as [
      string,
      { codeVerifier: string; mode: string; rememberLogin: boolean },
    ];

    expect(authorization.origin).toBe('https://github.com');
    expect(authorization.pathname).toBe('/login/oauth/authorize');
    expect(authorization.searchParams.get('client_id')).toBe(
      'github-client-id',
    );
    expect(authorization.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/auth/github/callback',
    );
    expect(authorization.searchParams.get('scope')).toBe(
      'read:user user:email',
    );
    expect(authorization.searchParams.has('repo')).toBe(false);
    expect(authorization.searchParams.get('state')).toBe(state);
    expect(authorization.searchParams.get('code_challenge_method')).toBe(
      'S256',
    );
    expect(authorization.searchParams.get('code_challenge')).toBe(
      createHash('sha256')
        .update(storedTransaction.codeVerifier)
        .digest('base64url'),
    );
    expect(storedTransaction).toMatchObject({
      mode: 'register',
      rememberLogin: false,
    });
    expect(result.cookieValue).toBe('browser-binding');
  });

  it('exchanges the code using the stored PKCE verifier and selects primary verified email', async () => {
    fetchFn
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'provider-access-token',
          token_type: 'bearer',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 123456, name: 'GitHub Name' }))
      .mockResolvedValueOnce(
        jsonResponse([
          { email: 'zeta@example.com', primary: false, verified: true },
          { email: 'primary@example.com', primary: true, verified: true },
          { email: 'aaa@example.com', primary: false, verified: false },
        ]),
      );

    const result = await service.complete(
      '/auth/github/callback?code=one-time-code&state=state-value',
      'browser-binding',
    );

    expect(states.consume).toHaveBeenCalledWith(
      'state-value',
      'browser-binding',
    );
    expect(fetchFn).toHaveBeenCalledTimes(3);
    const [tokenUrl, tokenRequest] = fetchFn.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(tokenUrl).toBe('https://github.com/login/oauth/access_token');
    if (typeof tokenRequest.body !== 'string') {
      throw new TypeError('Expected JSON token request body.');
    }
    expect(JSON.parse(tokenRequest.body)).toEqual({
      client_id: 'github-client-id',
      client_secret: 'server-only-github-secret',
      code: 'one-time-code',
      redirect_uri: 'http://localhost:3000/auth/github/callback',
      code_verifier: transaction.codeVerifier,
    });
    expect(fetchFn.mock.calls[1]?.[0]).toBe('https://api.github.com/user');
    expect(fetchFn.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: 'Bearer provider-access-token',
      }),
    });
    expect(fetchFn.mock.calls[2]?.[0]).toBe(
      'https://api.github.com/user/emails?per_page=100&page=1',
    );
    expect(result).toEqual({
      identity: {
        githubId: '123456',
        email: 'primary@example.com',
        emailVerified: true,
        fullName: 'GitHub Name',
      },
      mode: 'register',
      rememberLogin: false,
    });
  });

  it('selects the lexicographically first verified address when none is primary', async () => {
    fetchFn
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'provider-access-token',
          token_type: 'bearer',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 123456 }))
      .mockResolvedValueOnce(
        jsonResponse([
          { email: 'zeta@example.com', primary: false, verified: true },
          { email: 'beta@example.com', primary: false, verified: true },
        ]),
      );

    const result = await service.complete(
      '/auth/github/callback?code=one-time-code&state=state-value',
      'browser-binding',
    );

    expect(result.identity.email).toBe('beta@example.com');
  });

  it('rejects users without any verified email', async () => {
    fetchFn
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'provider-access-token',
          token_type: 'bearer',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 123456 }))
      .mockResolvedValueOnce(
        jsonResponse([
          { email: 'private@example.com', primary: true, verified: false },
        ]),
      );

    await expect(
      service.complete(
        '/auth/github/callback?code=one-time-code&state=state-value',
        'browser-binding',
      ),
    ).rejects.toMatchObject<Partial<GitHubOAuthFlowError>>({
      code: 'email_unverified',
      mode: 'register',
    });
  });

  it('rejects malformed token responses without exposing provider details', async () => {
    fetchFn.mockResolvedValueOnce(jsonResponse(null));

    await expect(
      service.complete(
        '/auth/github/callback?code=one-time-code&state=state-value',
        'browser-binding',
      ),
    ).rejects.toMatchObject<Partial<GitHubOAuthFlowError>>({
      code: 'provider_unavailable',
      mode: 'register',
    });
  });

  it('consumes state before handling cancellation and rejects replay without contacting GitHub', async () => {
    await expect(
      service.complete(
        '/auth/github/callback?error=access_denied&state=state-value',
        'browser-binding',
      ),
    ).rejects.toMatchObject<Partial<GitHubOAuthFlowError>>({
      code: 'provider_cancelled',
      mode: 'register',
    });
    states.consume.mockResolvedValueOnce(null);
    await expect(
      service.complete(
        '/auth/github/callback?code=code&state=state-value',
        'browser-binding',
      ),
    ).rejects.toMatchObject<Partial<GitHubOAuthFlowError>>({
      code: 'invalid_state',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects ambiguous callback parameters and invalid provider identities', async () => {
    await expect(
      service.complete(
        '/auth/github/callback?code=one&code=two&state=state-value',
        'browser-binding',
      ),
    ).rejects.toMatchObject({ code: 'invalid_callback' });

    fetchFn
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'provider-access-token',
          token_type: 'bearer',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: '123456' }));
    await expect(
      service.complete(
        '/auth/github/callback?code=one&state=state-value',
        'browser-binding',
      ),
    ).rejects.toMatchObject({ code: 'invalid_identity' });
  });

  it('returns a sanitized provider error without exposing credentials or response data', async () => {
    fetchFn.mockResolvedValueOnce(
      jsonResponse({
        error: 'bad_verification_code',
        error_description: 'sensitive provider response',
      }),
    );

    let thrown: unknown;
    try {
      await service.complete(
        '/auth/github/callback?code=one-time-code&state=state-value',
        'browser-binding',
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: 'provider_unavailable' });
    expect(String(thrown)).not.toContain('server-only-github-secret');
    expect(String(thrown)).not.toContain('sensitive provider response');
  });
});
