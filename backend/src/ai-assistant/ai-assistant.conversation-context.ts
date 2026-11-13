import { createHmac, timingSafeEqual } from 'node:crypto';
import { AI_ASSISTANT_FAQ } from './ai-assistant.knowledge.js';
import type { AiAssistantPrincipal } from './ai-assistant.guest-identity.js';
import type {
  AiAssistantConversationContext,
  AiAssistantConversationSeed,
  AiAssistantFaqId,
} from './ai-assistant.types.js';

const CONTEXT_VERSION = 1;
const CONTEXT_TTL_MS = 10 * 60 * 1_000;
const MAX_CONTEXT_TURNS = 3;
const MAX_CONTEXT_TOKEN_LENGTH = 2_048;
const VALID_INTENTS = new Set([
  'faq-guidance',
  'problem-workflow',
  'submission-results',
]);

type SignedConversationContext = AiAssistantConversationContext & {
  version: number;
  subject: string;
};

function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function isFaqId(value: unknown): value is AiAssistantFaqId {
  return (
    typeof value === 'string' &&
    AI_ASSISTANT_FAQ.some((faq) => faq.id === value)
  );
}

function isContextPayload(value: unknown): value is SignedConversationContext {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.version === CONTEXT_VERSION &&
    typeof payload.subject === 'string' &&
    typeof payload.intent === 'string' &&
    VALID_INTENTS.has(payload.intent) &&
    Array.isArray(payload.faqIds) &&
    payload.faqIds.length > 0 &&
    payload.faqIds.length <= 4 &&
    payload.faqIds.every(isFaqId) &&
    new Set(payload.faqIds).size === payload.faqIds.length &&
    Number.isSafeInteger(payload.turnsRemaining) &&
    Number(payload.turnsRemaining) >= 1 &&
    Number(payload.turnsRemaining) <= MAX_CONTEXT_TURNS &&
    Number.isSafeInteger(payload.issuedAt) &&
    Number.isSafeInteger(payload.expiresAt)
  );
}

function hasSameSignature(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

export function createAiAssistantConversationContextToken(
  secret: string,
  principal: AiAssistantPrincipal,
  seed: AiAssistantConversationSeed,
  previousContext?: AiAssistantConversationContext,
  now = Date.now(),
): string | undefined {
  if (!secret) return undefined;
  const inheritedContext = seed.continued ? previousContext : undefined;
  if (seed.continued && !inheritedContext) return undefined;

  const turnsRemaining = inheritedContext
    ? inheritedContext.turnsRemaining - 1
    : MAX_CONTEXT_TURNS;
  if (turnsRemaining < 1) return undefined;

  const issuedAt = inheritedContext ? inheritedContext.issuedAt : now;
  const expiresAt = inheritedContext
    ? inheritedContext.expiresAt
    : now + CONTEXT_TTL_MS;
  const payload: SignedConversationContext = {
    version: CONTEXT_VERSION,
    subject: hmac(secret, `subject:${principal.kind}:${principal.id}`),
    intent: seed.intent,
    faqIds: [...seed.faqIds],
    turnsRemaining,
    issuedAt,
    expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );
  const signature = hmac(secret, `context:${encodedPayload}`);
  return `${encodedPayload}.${signature}`;
}

export function readAiAssistantConversationContextToken(
  token: string | undefined,
  secret: string,
  principal: AiAssistantPrincipal,
  now = Date.now(),
): AiAssistantConversationContext | undefined {
  if (!token || !secret || token.length > MAX_CONTEXT_TOKEN_LENGTH) {
    return undefined;
  }

  const [encodedPayload, signature, extra] = token.split('.');
  if (
    !encodedPayload ||
    !signature ||
    extra !== undefined ||
    !/^[A-Za-z0-9_-]+$/u.test(encodedPayload)
  ) {
    return undefined;
  }

  const expectedSignature = hmac(secret, `context:${encodedPayload}`);
  if (!hasSameSignature(signature, expectedSignature)) return undefined;

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    );
  } catch {
    return undefined;
  }

  if (!isContextPayload(payload)) return undefined;
  const expectedSubject = hmac(
    secret,
    `subject:${principal.kind}:${principal.id}`,
  );
  if (!hasSameSignature(payload.subject, expectedSubject)) return undefined;
  if (
    payload.issuedAt > now + 30_000 ||
    payload.expiresAt <= now ||
    payload.expiresAt <= payload.issuedAt ||
    payload.expiresAt - payload.issuedAt > CONTEXT_TTL_MS
  ) {
    return undefined;
  }

  return {
    intent: payload.intent,
    faqIds: payload.faqIds,
    turnsRemaining: payload.turnsRemaining,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}
