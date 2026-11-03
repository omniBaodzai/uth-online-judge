import { Injectable } from '@nestjs/common';
import * as oidc from 'openid-client';
import {
  GoogleOAuthStateStore,
  type GoogleOAuthMode,
} from './google-oauth-state.store.js';

export type VerifiedGoogleIdentity = {
  googleId: string;
  email: string;
  emailVerified: true;
  fullName: string | null;
};

export class GoogleOAuthFlowError extends Error {
  constructor(
    readonly code:
      | 'invalid_state'
      | 'provider_cancelled'
      | 'invalid_callback'
      | 'email_unverified'
      | 'invalid_identity',
    readonly mode?: GoogleOAuthMode,
  ) {
    super(code);
    this.name = 'GoogleOAuthFlowError';
  }
}

export type GoogleOAuthAuthorization = {
  url: string;
  cookieName: string;
  cookieValue: string;
};

export type CompletedGoogleOAuth = {
  identity: VerifiedGoogleIdentity;
  mode: GoogleOAuthMode;
  rememberLogin: boolean;
};

@Injectable()
export class GoogleOAuthService {
  private configuration?: Promise<oidc.Configuration>;

  constructor(private readonly states: GoogleOAuthStateStore) {}

  async start(
    mode: GoogleOAuthMode,
    rememberLogin: boolean,
  ): Promise<GoogleOAuthAuthorization> {
    const config = await this.getConfiguration();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const cookie = await this.states.create(state, {
      codeVerifier,
      nonce,
      mode,
      rememberLogin,
    });
    const authorizationUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.getRedirectUri(),
      scope: 'openid email profile',
      response_type: 'code',
      prompt: 'select_account',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      nonce,
    });

    return {
      url: authorizationUrl.href,
      cookieName: cookie.cookieName,
      cookieValue: cookie.cookieValue,
    };
  }

  async complete(
    requestUrl: string,
    stateCookieValue: string | undefined,
  ): Promise<CompletedGoogleOAuth> {
    const callbackRequest = new URL(requestUrl, 'http://localhost');
    const stateValues = callbackRequest.searchParams.getAll('state');
    const state = stateValues.length === 1 ? stateValues[0] : undefined;
    if (!state) throw new GoogleOAuthFlowError('invalid_state');

    const transaction = await this.states.consume(state, stateCookieValue);
    if (!transaction) throw new GoogleOAuthFlowError('invalid_state');

    const errors = callbackRequest.searchParams.getAll('error');
    if (errors.length > 0) {
      throw new GoogleOAuthFlowError(
        errors.length === 1 && errors[0] === 'access_denied'
          ? 'provider_cancelled'
          : 'invalid_callback',
        transaction.mode,
      );
    }

    const codes = callbackRequest.searchParams.getAll('code');
    if (codes.length !== 1 || !codes[0]) {
      throw new GoogleOAuthFlowError('invalid_callback', transaction.mode);
    }

    const currentUrl = new URL(this.getRedirectUri());
    currentUrl.search = callbackRequest.search;
    const tokens = await oidc.authorizationCodeGrant(
      await this.getConfiguration(),
      currentUrl,
      {
        expectedState: state,
        expectedNonce: transaction.nonce,
        pkceCodeVerifier: transaction.codeVerifier,
      },
    );
    const claims = tokens.claims();

    if (
      !claims ||
      typeof claims.sub !== 'string' ||
      typeof claims.email !== 'string' ||
      !claims.email
    ) {
      throw new GoogleOAuthFlowError('invalid_identity', transaction.mode);
    }
    if (claims.email_verified !== true) {
      throw new GoogleOAuthFlowError('email_unverified', transaction.mode);
    }

    return {
      identity: {
        googleId: claims.sub,
        email: claims.email,
        emailVerified: true,
        fullName: typeof claims.name === 'string' ? claims.name : null,
      },
      mode: transaction.mode,
      rememberLogin: transaction.rememberLogin,
    };
  }

  private getConfiguration(): Promise<oidc.Configuration> {
    if (!this.configuration) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth client credentials are not configured.');
      }

      this.configuration = oidc
        .discovery(
          new URL('https://accounts.google.com'),
          clientId,
          clientSecret,
        )
        .catch((error: unknown) => {
          this.configuration = undefined;
          throw error;
        });
    }

    return this.configuration;
  }

  private getRedirectUri(): string {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!redirectUri) {
      throw new Error('GOOGLE_REDIRECT_URI is not configured.');
    }

    const parsed = new URL(redirectUri);
    const localHttp = parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (
      (parsed.protocol !== 'https:' && !localHttp) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('GOOGLE_REDIRECT_URI must be a local HTTP or HTTPS callback URL.');
    }

    return parsed.href;
  }
}
