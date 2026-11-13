export enum AiAssistantScope {
  IN_SCOPE = 'IN_SCOPE',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
  UNCERTAIN = 'UNCERTAIN',
}

export type AiAssistantLanguage = 'vi' | 'en';

export type AiAssistantResponseStyle = 'user' | 'technical';

export type AiAssistantTechnicalFocus =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR'
  | 'COMPILATION_ERROR'
  | 'INTERNAL_ERROR';

export type AiAssistantBasicIntent =
  'GREETING' | 'THANKS' | 'GOODBYE' | 'CAPABILITIES' | 'BOT_IDENTITY';

export type AiAssistantFaqId =
  | 'account-access'
  | 'oauth-sign-in'
  | 'password-reset'
  | 'password-change'
  | 'profile-management'
  | 'problem-search'
  | 'problem-details'
  | 'problem-editorial'
  | 'submit-problem'
  | 'submission-history'
  | 'submission-statuses'
  | 'contests'
  | 'contest-leaderboard'
  | 'global-leaderboard'
  | 'organizations'
  | 'discussions-comments'
  | 'notifications';

export type AiAssistantFaqTopic =
  | 'account'
  | 'profile'
  | 'problems'
  | 'submissions'
  | 'contests'
  | 'leaderboard'
  | 'organizations'
  | 'discussions'
  | 'notifications';

export type AiAssistantApprovedStatement = {
  id: string;
  phrases: Record<AiAssistantLanguage, readonly string[]>;
  technicalPhrases?: Record<AiAssistantLanguage, readonly string[]>;
};

export type AiAssistantFaqEntry = {
  id: AiAssistantFaqId;
  topic: AiAssistantFaqTopic;
  question: Record<AiAssistantLanguage, string>;
  answer: Record<AiAssistantLanguage, string>;
  technicalAnswer?: Record<AiAssistantLanguage, string>;
  approvedStatements: readonly AiAssistantApprovedStatement[];
  sources: readonly string[];
  allowedRoutes: readonly string[];
};

export type AiAssistantGlossaryEntry = {
  id: string;
  faqId: AiAssistantFaqId;
  statementId: string;
  aliases: readonly string[];
  phrases: Record<AiAssistantLanguage, string>;
};

export type AiAssistantGeneratedClaim = {
  sourceId: string;
  text: string;
};

export type AiAssistantConversationIntent =
  'faq-guidance' | 'problem-workflow' | 'submission-results';

export type AiAssistantConversationContext = {
  intent: AiAssistantConversationIntent;
  faqIds: readonly AiAssistantFaqId[];
  turnsRemaining: number;
  issuedAt: number;
  expiresAt: number;
};

export type AiAssistantConversationSeed = {
  intent: AiAssistantConversationIntent;
  faqIds: readonly AiAssistantFaqId[];
  continued: boolean;
};

export type AiAssistantScopeDecision = {
  scope: AiAssistantScope;
  language: AiAssistantLanguage;
  faq?: AiAssistantFaqEntry;
  faqs?: readonly AiAssistantFaqEntry[];
  conversation?: AiAssistantConversationSeed;
  basicIntent?: AiAssistantBasicIntent;
  basicReply?: string;
  responseStyle?: AiAssistantResponseStyle;
  technicalFocus?: AiAssistantTechnicalFocus;
  clarification?: 'problem-topic';
  reason?:
    | 'sensitive_input'
    | 'security_refusal'
    | 'negated_request'
    | 'needs_clarification';
};

export type AiAssistantChatResponse = {
  scope: AiAssistantScope;
  answer: string;
  conversationContext?: string;
};
