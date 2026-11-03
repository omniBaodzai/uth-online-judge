import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

export const GITHUB_OAUTH_STATE_TTL_SECONDS = 5 * 60;
export const GITHUB_OAUTH_STATE_COOKIE_PATH = '/auth/github';
export const GITHUB_OAUTH_REDIS = 'GITHUB_OAUTH_REDIS';

export type GitHubOAuthMode = 'login' | 'register';

export type GitHubOAuthTransaction = {
  codeVerifier: string;
  mode: GitHubOAuthMode;
  rememberLogin: boolean;
};

type StoredGitHubOAuthTransaction = GitHubOAuthTransaction & {
  browserBindingHash: string;
};

@Injectable()
export class GitHubOAuthStateStore {
  constructor(
    @Inject(GITHUB_OAUTH_REDIS)
    private readonly redis: Redis,
  ) {}

  async create(
    state: string,
    transaction: GitHubOAuthTransaction,
  ): Promise<{ cookieName: string; cookieValue: string }> {
    const cookieValue = randomBytes(32).toString('base64url');
    const stored: StoredGitHubOAuthTransaction = {
      ...transaction,
      browserBindingHash: hash(cookieValue),
    };
    const result = await this.redis.set(
      redisKey(state),
      JSON.stringify(stored),
      'EX',
      GITHUB_OAUTH_STATE_TTL_SECONDS,
      'NX',
    );

    if (result !== 'OK') {
      throw new Error('Could not reserve a unique GitHub OAuth state.');
    }

    return { cookieName: githubOAuthStateCookieName(state), cookieValue };
  }

  async consume(
    state: string,
    cookieValue: string | undefined,
  ): Promise<GitHubOAuthTransaction | null> {
    const storedValue: unknown = await this.redis.call(
      'GETDEL',
      redisKey(state),
    );
    if (typeof storedValue !== 'string') return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(storedValue);
    } catch {
      return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;
    const stored = parsed as StoredGitHubOAuthTransaction;

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
      (stored.mode !== 'login' && stored.mode !== 'register') ||
      typeof stored.rememberLogin !== 'boolean'
    ) {
      return null;
    }

    return {
      codeVerifier: stored.codeVerifier,
      mode: stored.mode,
      rememberLogin: stored.rememberLogin,
    };
  }
}

export function githubOAuthStateCookieName(state: string): string {
  return `uth_github_oauth_${hash(state).slice(0, 24)}`;
}

function redisKey(state: string): string {
  return `oauth:github:state:${hash(state)}`;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
