import { GoogleOAuthStateStore } from './google-oauth-state.store.js';

describe('GoogleOAuthStateStore', () => {
  it('stores PKCE data with a short TTL and binds it to a per-flow browser cookie', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      call: vi.fn(),
    };
    const store = new GoogleOAuthStateStore(redis as never);

    const cookie = await store.create('opaque-state', {
      codeVerifier: 'pkce-verifier',
      nonce: 'oidc-nonce',
      mode: 'register',
      rememberLogin: true,
    });

    expect(cookie.cookieName).toMatch(/^uth_google_oauth_[a-f0-9]{24}$/);
    expect(cookie.cookieValue).not.toBe('opaque-state');
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^oauth:google:state:[a-f0-9]{64}$/),
      expect.stringContaining('"codeVerifier":"pkce-verifier"'),
      'EX',
      300,
      'NX',
    );
    expect(redis.set.mock.calls[0]?.[0]).not.toContain('opaque-state');
    expect(redis.set.mock.calls[0]?.[1]).toContain(
      '"browserBindingHash":"',
    );
  });

  it('atomically consumes state only for the browser holding the binding cookie', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      call: vi.fn(),
    };
    const store = new GoogleOAuthStateStore(redis as never);
    const transaction = {
      codeVerifier: 'pkce-verifier',
      nonce: 'oidc-nonce',
      mode: 'login' as const,
      rememberLogin: false,
    };
    const cookie = await store.create('opaque-state', transaction);
    const stored = JSON.parse(redis.set.mock.calls[0]?.[1] as string) as object;
    redis.call
      .mockResolvedValueOnce(JSON.stringify(stored))
      .mockResolvedValueOnce(null);

    await expect(store.consume('opaque-state', cookie.cookieValue)).resolves.toEqual(
      transaction,
    );
    await expect(store.consume('opaque-state', cookie.cookieValue)).resolves.toBeNull();

    expect(redis.call).toHaveBeenNthCalledWith(
      1,
      'GETDEL',
      expect.stringMatching(/^oauth:google:state:[a-f0-9]{64}$/),
    );
  });

  it('rejects a callback from a different browser and consumes its state', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      call: vi.fn(),
    };
    const store = new GoogleOAuthStateStore(redis as never);
    await store.create('opaque-state', {
      codeVerifier: 'pkce-verifier',
      nonce: 'oidc-nonce',
      mode: 'login',
      rememberLogin: true,
    });
    const stored = JSON.parse(redis.set.mock.calls[0]?.[1] as string) as object;
    redis.call.mockResolvedValueOnce(JSON.stringify(stored));

    await expect(store.consume('opaque-state', 'other-browser-cookie')).resolves.toBeNull();
    expect(redis.call).toHaveBeenCalledWith('GETDEL', expect.any(String));
  });

  it('rejects corrupt state entries without trusting their stored fields', async () => {
    const redis = {
      set: vi.fn(),
      call: vi.fn().mockResolvedValue('null'),
    };
    const store = new GoogleOAuthStateStore(redis as never);

    await expect(store.consume('opaque-state', 'browser-cookie')).resolves.toBeNull();
  });
});
