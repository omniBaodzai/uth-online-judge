import {
  GITHUB_OAUTH_STATE_TTL_SECONDS,
  GitHubOAuthStateStore,
  githubOAuthStateCookieName,
} from './github-oauth-state.store.js';

describe('GitHubOAuthStateStore', () => {
  it('stores PKCE data with a short TTL and a per-flow browser binding', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      call: vi.fn(),
    };
    const store = new GitHubOAuthStateStore(redis as never);

    const cookie = await store.create('opaque-state', {
      codeVerifier: 'pkce-verifier',
      mode: 'register',
      rememberLogin: true,
    });

    expect(cookie.cookieName).toBe(githubOAuthStateCookieName('opaque-state'));
    expect(cookie.cookieName).toMatch(/^uth_github_oauth_[a-f0-9]{24}$/);
    expect(cookie.cookieValue).not.toBe('opaque-state');
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^oauth:github:state:[a-f0-9]{64}$/),
      expect.stringContaining('"codeVerifier":"pkce-verifier"'),
      'EX',
      GITHUB_OAUTH_STATE_TTL_SECONDS,
      'NX',
    );
    expect(redis.set.mock.calls[0]?.[1]).toContain('"browserBindingHash":"');
  });

  it('consumes state once and requires the original browser binding', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      call: vi.fn(),
    };
    const store = new GitHubOAuthStateStore(redis as never);
    const transaction = {
      codeVerifier: 'pkce-verifier',
      mode: 'login' as const,
      rememberLogin: false,
    };
    const cookie = await store.create('opaque-state', transaction);
    const stored = JSON.parse(redis.set.mock.calls[0]?.[1] as string) as object;
    redis.call
      .mockResolvedValueOnce(JSON.stringify(stored))
      .mockResolvedValueOnce(null);

    await expect(
      store.consume('opaque-state', cookie.cookieValue),
    ).resolves.toEqual(transaction);
    await expect(
      store.consume('opaque-state', cookie.cookieValue),
    ).resolves.toBeNull();
    expect(redis.call).toHaveBeenNthCalledWith(
      1,
      'GETDEL',
      expect.stringMatching(/^oauth:github:state:[a-f0-9]{64}$/),
    );
  });

  it('rejects a callback from a different browser and consumes its state', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      call: vi.fn(),
    };
    const store = new GitHubOAuthStateStore(redis as never);
    await store.create('opaque-state', {
      codeVerifier: 'pkce-verifier',
      mode: 'login',
      rememberLogin: true,
    });
    const stored = JSON.parse(redis.set.mock.calls[0]?.[1] as string) as object;
    redis.call.mockResolvedValueOnce(JSON.stringify(stored));

    await expect(
      store.consume('opaque-state', 'other-browser-cookie'),
    ).resolves.toBeNull();
    expect(redis.call).toHaveBeenCalledWith('GETDEL', expect.any(String));
  });
});
