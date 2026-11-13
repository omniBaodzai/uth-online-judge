import { ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { loadAiAssistantConfig } from './ai-assistant.config.js';
import {
  AI_ASSISTANT_GUEST_COOKIE_NAME,
  AiAssistantGuestIdentity,
} from './ai-assistant.guest-identity.js';

const secret = 'test-guest-cookie-secret-with-32-bytes-minimum';

function createIdentity(override: Record<string, string> = {}) {
  const config = loadAiAssistantConfig({
    AI_ASSISTANT_GUEST_COOKIE_SECRET: secret,
    ...override,
  });
  return new AiAssistantGuestIdentity(config);
}

function createRequest(cookie?: string) {
  return {
    headers: cookie ? { cookie } : {},
  } as Request;
}

function createResponse() {
  return { cookie: vi.fn() } as unknown as Response;
}

function cookieFrom(response: Response): string {
  const cookieCall = vi.mocked(response.cookie).mock.calls[0];
  if (!cookieCall) throw new Error('Expected a guest cookie to be set.');
  return cookieCall[1];
}

describe('AiAssistantGuestIdentity', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an opaque, signed, HttpOnly cookie limited to the AI route', () => {
    const identity = createIdentity();
    const response = createResponse();
    const principal = identity.resolve(createRequest(), response);
    const [name, token, options] = vi.mocked(response.cookie).mock.calls[0]!;

    expect(principal.kind).toBe('guest');
    expect(name).toBe(AI_ASSISTANT_GUEST_COOKIE_NAME);
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]{43}\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(token).not.toContain('@');
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/ai-assistant',
      maxAge: 86_400_000,
    });
  });

  it('reuses a valid guest cookie without issuing a new one', () => {
    const identity = createIdentity();
    const originalResponse = createResponse();
    const originalPrincipal = identity.resolve(
      createRequest(),
      originalResponse,
    );
    const token = cookieFrom(originalResponse);
    const nextResponse = createResponse();

    const nextPrincipal = identity.resolve(
      createRequest(`${AI_ASSISTANT_GUEST_COOKIE_NAME}=${token}`),
      nextResponse,
    );

    expect(nextPrincipal).toEqual(originalPrincipal);
    expect(nextResponse.cookie).not.toHaveBeenCalled();
  });

  it.each([
    [
      'modified signature',
      (token: string) =>
        `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`,
    ],
    ['malformed token', () => 'not-a-valid-cookie'],
    ['oversized cookie', () => 'x'.repeat(257)],
  ])('replaces an invalid or %s cookie with a fresh identity', (_label, edit) => {
    const identity = createIdentity();
    const originalResponse = createResponse();
    const original = identity.resolve(createRequest(), originalResponse);
    const badToken = edit(cookieFrom(originalResponse));
    const nextResponse = createResponse();

    const next = identity.resolve(
      createRequest(`${AI_ASSISTANT_GUEST_COOKIE_NAME}=${badToken}`),
      nextResponse,
    );

    expect(next.kind).toBe('guest');
    expect(next.id).not.toBe(original.id);
    expect(nextResponse.cookie).toHaveBeenCalledOnce();
  });

  it('replaces an expired cookie', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const identity = createIdentity({
      AI_ASSISTANT_GUEST_COOKIE_TTL_SECONDS: '300',
    });
    const originalResponse = createResponse();
    const original = identity.resolve(createRequest(), originalResponse);
    const token = cookieFrom(originalResponse);
    vi.advanceTimersByTime(301_000);
    const nextResponse = createResponse();

    const next = identity.resolve(
      createRequest(`${AI_ASSISTANT_GUEST_COOKIE_NAME}=${token}`),
      nextResponse,
    );

    expect(next.id).not.toBe(original.id);
    expect(nextResponse.cookie).toHaveBeenCalledOnce();
  });

  it('fails closed without a sufficiently long cookie secret', () => {
    const identity = createIdentity({
      AI_ASSISTANT_GUEST_COOKIE_SECRET: 'too-short',
    });
    const response = createResponse();

    expect(() => identity.resolve(createRequest(), response)).toThrow(
      ServiceUnavailableException,
    );
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('hashes the peer IP without exposing it in the limiter identity', () => {
    const identity = createIdentity();

    const mappedIpv4 = identity.hashIpAddress('::ffff:127.0.0.1');
    expect(mappedIpv4).toBe(identity.hashIpAddress('127.0.0.1'));
    expect(mappedIpv4).not.toContain('127.0.0.1');
    expect(mappedIpv4).not.toBe(identity.hashIpAddress('127.0.0.2'));
  });
});
