import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

export const GOOGLE_OAUTH_STATE_TTL_SECONDS = 5 * 60;
export const GOOGLE_OAUTH_STATE_COOKIE_PATH = '/auth/google';
export const GOOGLE_OAUTH_REDIS = 'GOOGLE_OAUTH_REDIS';

export type GoogleOAuthMode = 'login' | 'register';

export type GoogleOAuthTransaction = {
  codeVerifier: string;
  nonce: string;
  mode: GoogleOAuthMode;
  rememberLogin: boolean;
};

type StoredGoogleOAuthTransaction = GoogleOAuthTransaction & {
  browserBindingHash: string;
};

@Injectable()
export class GoogleOAuthStateStore {
  constructor(
    @Inject(GOOGLE_OAUTH_REDIS)
    private readonly redis: Redis,
  ) {}

  async create(
    state: string,
    transaction: GoogleOAuthTransaction,
  ): Promise<{ cookieName: string; cookieValue: string }> {
    const cookieValue = randomBytes(32).toString('base64url');
    const stored: StoredGoogleOAuthTransaction = {
      ...transaction,
      browserBindingHash: hash(cookieValue),
    };
    const result = await this.redis.set(
      redisKey(state),
      JSON.stringify(stored),
      'EX',
      GOOGLE_OAUTH_STATE_TTL_SECONDS,
      'NX',
    );

    if (result !== 'OK') {
      throw new Error('Could not reserve a unique Google OAuth state.');
    }

    return { cookieName: googleOAuthStateCookieName(state), cookieValue };
  }

  async consume(
    state: string,
    cookieValue: string | undefined,
  ): Promise<GoogleOAuthTransaction | null> {
    const storedValue: unknown = await this.redis.call('GETDEL', redisKey(state));
    if (typeof storedValue !== 'string') return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(storedValue);
    } catch {
      return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;
    const stored = parsed as StoredGoogleOAuthTransaction;

    if (
      !cookieValue ||
      typeof stored.browserBindingHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(stored.browserBindingHash) ||
      !timingSafeEqual(
        Buffer.from(stored.browserBindingHash, 'hex'),
        Buffer.from(hash(cookieValue), 'hex'),
      )
    ) {
      return null;
    }

    if (
      typeof stored.codeVerifier !== 'string' ||
      typeof stored.nonce !== 'string' ||
      (stored.mode !== 'login' && stored.mode !== 'register') ||
      typeof stored.rememberLogin !== 'boolean'
    ) {
      return null;
    }

    return {
      codeVerifier: stored.codeVerifier,
      nonce: stored.nonce,
      mode: stored.mode,
      rememberLogin: stored.rememberLogin,
    };
  }
}

export function googleOAuthStateCookieName(state: string): string {
  return `uth_google_oauth_${hash(state).slice(0, 24)}`;
}

function redisKey(state: string): string {
  return `oauth:google:state:${hash(state)}`;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
