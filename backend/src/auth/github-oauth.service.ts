import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { isEmail } from 'class-validator';
import {
  GitHubOAuthStateStore,
  type GitHubOAuthMode,
} from './github-oauth-state.store.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_REQUEST_TIMEOUT_MS = 10_000;
const GITHUB_EMAIL_PAGE_SIZE = 100;
const GITHUB_EMAIL_MAX_PAGES = 10;
export const GITHUB_OAUTH_FETCH = 'GITHUB_OAUTH_FETCH';

type GitHubOAuthErrorCode =
  | 'invalid_state'
  | 'provider_cancelled'
  | 'invalid_callback'
  | 'email_unverified'
  | 'invalid_identity'
  | 'provider_unavailable';

export type VerifiedGitHubIdentity = {
  githubId: string;
  email: string;
  emailVerified: true;
  fullName: string | null;
};

export class GitHubOAuthFlowError extends Error {
  constructor(
    readonly code: GitHubOAuthErrorCode,
    readonly mode?: GitHubOAuthMode,
  ) {
    super(code);
    this.name = 'GitHubOAuthFlowError';
  }
}

export type GitHubOAuthAuthorization = {
  url: string;
  cookieName: string;
  cookieValue: string;
};

export type CompletedGitHubOAuth = {
  identity: VerifiedGitHubIdentity;
  mode: GitHubOAuthMode;
  rememberLogin: boolean;
};

type GitHubOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type GitHubUser = {
  id: number;
  name?: string | null;
};

type GitHubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

type GitHubTokenResponse = {
  access_token: string;
  token_type: string;
  error?: string;
};

type FetchFn = typeof fetch;

@Injectable()
export class GitHubOAuthService {
  private config?: GitHubOAuthConfig;
  private readonly fetchFn: FetchFn;

  constructor(
    private readonly states: GitHubOAuthStateStore,
    @Optional() @Inject(GITHUB_OAUTH_FETCH) fetchFn?: FetchFn,
  ) {
    this.fetchFn = fetchFn ?? fetch;
  }

  async start(
    mode: GitHubOAuthMode,
    rememberLogin: boolean,
  ): Promise<GitHubOAuthAuthorization> {
    let config: GitHubOAuthConfig;
    try {
      config = this.getConfig();
    } catch {
      throw new GitHubOAuthFlowError('provider_unavailable', mode);
    }
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const cookie = await this.states.create(state, {
      codeVerifier,
      mode,
      rememberLogin,
    });

    const authorizationUrl = new URL(GITHUB_AUTHORIZE_URL);
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('scope', 'read:user user:email');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');

    return {
      url: authorizationUrl.href,
      cookieName: cookie.cookieName,
      cookieValue: cookie.cookieValue,
    };
  }

  async complete(
    requestUrl: string,
    stateCookieValue: string | undefined,
  ): Promise<CompletedGitHubOAuth> {
    const callbackRequest = new URL(requestUrl, 'http://localhost');
    const stateValues = callbackRequest.searchParams.getAll('state');
    const state = stateValues.length === 1 ? stateValues[0] : undefined;
    if (!state) throw new GitHubOAuthFlowError('invalid_state');

    const transaction = await this.states.consume(state, stateCookieValue);
    if (!transaction) throw new GitHubOAuthFlowError('invalid_state');

    const errors = callbackRequest.searchParams.getAll('error');
    if (errors.length > 0) {
      throw new GitHubOAuthFlowError(
        errors.length === 1 && errors[0] === 'access_denied'
          ? 'provider_cancelled'
          : 'invalid_callback',
        transaction.mode,
      );
    }

    const codes = callbackRequest.searchParams.getAll('code');
    if (codes.length !== 1 || !codes[0]) {
      throw new GitHubOAuthFlowError('invalid_callback', transaction.mode);
    }

    let config: GitHubOAuthConfig;
    try {
      config = this.getConfig();
    } catch {
      throw new GitHubOAuthFlowError('provider_unavailable', transaction.mode);
    }
    const tokenResponse = await this.requestJson<GitHubTokenResponse>(
      GITHUB_TOKEN_URL,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: codes[0],
          redirect_uri: config.redirectUri,
          code_verifier: transaction.codeVerifier,
        }),
      },
      transaction.mode,
    );
    if (
      !isRecord(tokenResponse) ||
      tokenResponse.error ||
      typeof tokenResponse.access_token !== 'string' ||
      !tokenResponse.access_token ||
      typeof tokenResponse.token_type !== 'string' ||
      tokenResponse.token_type.toLowerCase() !== 'bearer'
    ) {
      throw new GitHubOAuthFlowError('provider_unavailable', transaction.mode);
    }

    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenResponse.access_token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    };
    const githubUser = await this.requestJson<GitHubUser>(
      `${GITHUB_API_URL}/user`,
      { headers },
      transaction.mode,
    );
    if (
      !isRecord(githubUser) ||
      typeof githubUser.id !== 'number' ||
      !Number.isSafeInteger(githubUser.id) ||
      githubUser.id <= 0 ||
      (githubUser.name !== undefined &&
        githubUser.name !== null &&
        typeof githubUser.name !== 'string')
    ) {
      throw new GitHubOAuthFlowError('invalid_identity', transaction.mode);
    }

    const email = await this.getVerifiedEmail(headers, transaction.mode);
    return {
      identity: {
        githubId: String(githubUser.id),
        email,
        emailVerified: true,
        fullName: typeof githubUser.name === 'string' ? githubUser.name : null,
      },
      mode: transaction.mode,
      rememberLogin: transaction.rememberLogin,
    };
  }

  private async getVerifiedEmail(
    headers: Record<string, string>,
    mode: GitHubOAuthMode,
  ): Promise<string> {
    const verifiedEmails: GitHubEmail[] = [];

    for (let page = 1; page <= GITHUB_EMAIL_MAX_PAGES; page += 1) {
      const emails = await this.requestJson<unknown>(
        `${GITHUB_API_URL}/user/emails?per_page=${GITHUB_EMAIL_PAGE_SIZE}&page=${page}`,
        { headers },
        mode,
      );
      if (!Array.isArray(emails)) {
        throw new GitHubOAuthFlowError('provider_unavailable', mode);
      }

      for (const item of emails) {
        if (
          isRecord(item) &&
          typeof item.email === 'string' &&
          typeof item.primary === 'boolean' &&
          typeof item.verified === 'boolean'
        ) {
          const normalizedEmail = item.email.trim().toLowerCase();
          if (item.verified && isEmail(normalizedEmail)) {
            verifiedEmails.push({
              email: normalizedEmail,
              primary: item.primary,
              verified: item.verified,
            });
          }
        }
      }

      if (emails.length < GITHUB_EMAIL_PAGE_SIZE) break;
      if (page === GITHUB_EMAIL_MAX_PAGES) {
        throw new GitHubOAuthFlowError('provider_unavailable', mode);
      }
    }

    verifiedEmails.sort(
      (left, right) =>
        Number(right.primary) - Number(left.primary) ||
        (left.email < right.email ? -1 : left.email > right.email ? 1 : 0),
    );
    const selected = verifiedEmails[0];
    if (!selected) {
      throw new GitHubOAuthFlowError('email_unverified', mode);
    }
    return selected.email;
  }

  private async requestJson<T>(
    url: string,
    init: RequestInit,
    mode: GitHubOAuthMode,
  ): Promise<T> {
    try {
      const response = await this.fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new GitHubOAuthFlowError('provider_unavailable', mode);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof GitHubOAuthFlowError) throw error;
      throw new GitHubOAuthFlowError('provider_unavailable', mode);
    }
  }

  private getConfig(): GitHubOAuthConfig {
    if (!this.config) {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;
      const redirectUri = process.env.GITHUB_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('GitHub OAuth client configuration is incomplete.');
      }

      const parsed = new URL(redirectUri);
      const localHttp =
        parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(parsed.hostname);
      if (
        (parsed.protocol !== 'https:' && !localHttp) ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash
      ) {
        throw new Error(
          'GITHUB_REDIRECT_URI must be a local HTTP or HTTPS callback URL.',
        );
      }

      this.config = {
        clientId,
        clientSecret,
        redirectUri: parsed.href,
      };
    }

    return this.config;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
