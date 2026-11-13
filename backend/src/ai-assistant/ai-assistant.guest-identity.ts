import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AI_ASSISTANT_CONFIG,
  type AiAssistantConfig,
} from './ai-assistant.config.js';

export const AI_ASSISTANT_GUEST_COOKIE_NAME = 'uth_ai_assistant_guest';
const COOKIE_PATH = '/ai-assistant';
const MAX_COOKIE_HEADER_LENGTH = 16_384;
const MAX_COOKIE_VALUE_LENGTH = 256;
const GUEST_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type AiAssistantPrincipal =
  | { kind: 'guest'; id: string }
  | { kind: 'user'; id: string };

function getCookieValue(request: Request): string | undefined {
  const header = request.headers.cookie;
  if (!header || header.length > MAX_COOKIE_HEADER_LENGTH) return undefined;

  let value: string | undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== AI_ASSISTANT_GUEST_COOKIE_NAME) {
      continue;
    }
    if (value !== undefined) return undefined;
    value = part.slice(separator + 1).trim();
  }

  return value && value.length <= MAX_COOKIE_VALUE_LENGTH ? value : undefined;
}

@Injectable()
export class AiAssistantGuestIdentity {
  constructor(
    @Inject(AI_ASSISTANT_CONFIG)
    private readonly config: AiAssistantConfig,
  ) {}

  resolve(request: Request, response: Response): AiAssistantPrincipal {
    const secret = this.requireSecret();
    const existing = this.readValidGuestId(
      getCookieValue(request),
      secret,
      Math.floor(Date.now() / 1_000),
    );
    if (existing) {
      return { kind: 'guest', id: this.digest(secret, `identity:${existing}`) };
    }

    const guestId = randomBytes(32).toString('base64url');
    const expiresAt =
      Math.floor(Date.now() / 1_000) + this.config.guestCookieTtlSeconds;
    const payload = `v1.${guestId}.${expiresAt}`;
    const signature = this.sign(secret, payload);
    response.cookie(
      AI_ASSISTANT_GUEST_COOKIE_NAME,
      `${payload}.${signature}`,
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.guestCookieSecure,
        path: COOKIE_PATH,
        maxAge: this.config.guestCookieTtlSeconds * 1_000,
      },
    );

    return { kind: 'guest', id: this.digest(secret, `identity:${guestId}`) };
  }

  hashIpAddress(address: string | undefined): string {
    if (!address) {
      throw new ServiceUnavailableException(
        'UTH AI Assistant rate limiting is unavailable.',
      );
    }

    const normalized = address.startsWith('::ffff:')
      ? address.slice('::ffff:'.length)
      : address;
    if (isIP(normalized) === 0) {
      throw new ServiceUnavailableException(
        'UTH AI Assistant rate limiting is unavailable.',
      );
    }

    return this.digest(this.requireSecret(), `ip:${normalized}`);
  }

  private readValidGuestId(
    token: string | undefined,
    secret: string,
    nowSeconds: number,
  ): string | undefined {
    if (!token || token.length > MAX_COOKIE_VALUE_LENGTH) return undefined;
    const [version, guestId, expiresAtValue, signature, extra] =
      token.split('.');
    if (
      version !== 'v1' ||
      !guestId ||
      !GUEST_ID_PATTERN.test(guestId) ||
      !expiresAtValue ||
      !/^\d{1,12}$/.test(expiresAtValue) ||
      !signature ||
      !SIGNATURE_PATTERN.test(signature) ||
      extra !== undefined
    ) {
      return undefined;
    }

    const expiresAt = Number(expiresAtValue);
    if (
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= nowSeconds ||
      expiresAt > nowSeconds + this.config.guestCookieTtlSeconds + 1
    ) {
      return undefined;
    }

    const expected = Buffer.from(
      this.sign(secret, `${version}.${guestId}.${expiresAtValue}`),
      'base64url',
    );
    const supplied = Buffer.from(signature, 'base64url');
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    ) {
      return undefined;
    }
    return guestId;
  }

  private requireSecret(): string {
    if (Buffer.byteLength(this.config.guestCookieSecret) < 32) {
      throw new ServiceUnavailableException(
        'UTH AI Assistant guest access is not configured.',
      );
    }
    return this.config.guestCookieSecret;
  }

  private sign(secret: string, value: string): string {
    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  private digest(secret: string, value: string): string {
    return createHmac('sha256', secret).update(value).digest('base64url');
  }
}
