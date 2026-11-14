import {
  createAiAssistantConversationContextToken,
  readAiAssistantConversationContextToken,
} from './ai-assistant.conversation-context.js';
import type { AiAssistantPrincipal } from './ai-assistant.guest-identity.js';
import type {
  AiAssistantConversationContext,
  AiAssistantConversationSeed,
} from './ai-assistant.types.js';

const secret = 'test-secret-with-more-than-32-characters';
const principal: AiAssistantPrincipal = { kind: 'guest', id: 'guest-123' };
const seed: AiAssistantConversationSeed = {
  intent: 'problem-workflow',
  faqIds: ['problem-search', 'problem-details', 'submit-problem'],
  continued: false,
};

function createToken(now = 1_000_000): string {
  const token = createAiAssistantConversationContextToken(
    secret,
    principal,
    seed,
    undefined,
    now,
  );
  if (!token) throw new Error('Expected a signed conversation context.');
  return token;
}

describe('AI Assistant conversation context', () => {
  it('signs minimal FAQ context without embedding the user identity or message', () => {
    const token = createToken();
    const encodedPayload = token.split('.')[0];
    if (!encodedPayload) throw new Error('Expected a token payload.');
    const serializedPayload = Buffer.from(encodedPayload, 'base64url').toString(
      'utf8',
    );

    expect(serializedPayload).not.toContain(principal.id);
    expect(serializedPayload).not.toContain('raw question');
    expect(
      readAiAssistantConversationContextToken(
        token,
        secret,
        principal,
        1_000_001,
      ),
    ).toEqual({
      intent: 'problem-workflow',
      faqIds: ['problem-search', 'problem-details', 'submit-problem'],
      turnsRemaining: 3,
      issuedAt: 1_000_000,
      expiresAt: 1_600_000,
    });
  });

  it('rejects altered, expired, and different-principal contexts', () => {
    const token = createToken();
    const otherPrincipal: AiAssistantPrincipal = {
      kind: 'guest',
      id: 'guest-456',
    };

    expect(
      readAiAssistantConversationContextToken(
        `${token.slice(0, -1)}x`,
        secret,
        principal,
        1_000_001,
      ),
    ).toBeUndefined();
    expect(
      readAiAssistantConversationContextToken(
        token,
        secret,
        principal,
        1_600_000,
      ),
    ).toBeUndefined();
    expect(
      readAiAssistantConversationContextToken(
        token,
        secret,
        otherPrincipal,
        1_000_001,
      ),
    ).toBeUndefined();
  });

  it('decrements the remaining follow-up turns and stops issuing context at zero', () => {
    const twoTurnsRemaining: AiAssistantConversationContext = {
      intent: 'problem-workflow',
      faqIds: seed.faqIds,
      turnsRemaining: 2,
      issuedAt: 1_000_000,
      expiresAt: 1_600_000,
    };
    const oneTurnToken = createAiAssistantConversationContextToken(
      secret,
      principal,
      { ...seed, continued: true },
      twoTurnsRemaining,
      1_100_000,
    );
    if (!oneTurnToken) throw new Error('Expected one remaining turn.');
    expect(
      readAiAssistantConversationContextToken(
        oneTurnToken,
        secret,
        principal,
        1_100_001,
      )?.turnsRemaining,
    ).toBe(1);

    const previousContext: AiAssistantConversationContext = {
      intent: 'problem-workflow',
      faqIds: seed.faqIds,
      turnsRemaining: 1,
      issuedAt: 1_000_000,
      expiresAt: 1_600_000,
    };
    const token = createAiAssistantConversationContextToken(
      secret,
      principal,
      { ...seed, continued: true },
      previousContext,
      1_100_000,
    );

    expect(token).toBeUndefined();
  });
});
