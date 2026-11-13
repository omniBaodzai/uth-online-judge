import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AI_ASSISTANT_CONFIG,
  type AiAssistantConfig,
} from './ai-assistant.config.js';
import {
  AI_ASSISTANT_FAQ,
  findAiAssistantGlossaryMatches,
} from './ai-assistant.knowledge.js';
import {
  createAiAssistantConversationContextToken,
  readAiAssistantConversationContextToken,
} from './ai-assistant.conversation-context.js';
import { AiAssistantRateLimit } from './ai-assistant.rate-limit.js';
import { AiAssistantGuestIdentity } from './ai-assistant.guest-identity.js';
import { AiAssistantOutputPolicy } from './ai-assistant.output-policy.js';
import { AiAssistantScopePolicy } from './ai-assistant.scope-policy.js';
import {
  OpenRouterClient,
  OpenRouterProviderError,
} from './openrouter.client.js';
import type { AiAssistantPrincipal } from './ai-assistant.guest-identity.js';
import {
  AiAssistantScope,
  type AiAssistantConversationIntent,
  type AiAssistantFaqEntry,
  type AiAssistantFaqId,
  type AiAssistantGlossaryEntry,
  type AiAssistantChatResponse,
  type AiAssistantResponseStyle,
  type AiAssistantTechnicalFocus,
} from './ai-assistant.types.js';

function getLoggableFinishReason(value: unknown): string {
  if (value === undefined || value === null) return 'missing';
  if (
    value === 'stop' ||
    value === 'length' ||
    value === 'content_filter' ||
    value === 'tool_calls' ||
    value === 'function_call'
  ) {
    return value;
  }
  return 'other';
}

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    @Inject(AI_ASSISTANT_CONFIG) private readonly config: AiAssistantConfig,
    private readonly scopePolicy: AiAssistantScopePolicy,
    private readonly outputPolicy: AiAssistantOutputPolicy,
    private readonly rateLimit: AiAssistantRateLimit,
    private readonly guestIdentity: AiAssistantGuestIdentity,
    private readonly openRouter: OpenRouterClient,
  ) {}

  async chat(
    principal: AiAssistantPrincipal | undefined,
    message: string,
    remoteAddress: string | undefined,
    conversationContextToken?: string,
  ): Promise<AiAssistantChatResponse> {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException(
        'UTH AI Assistant is currently disabled.',
      );
    }
    if (!principal) {
      throw new ServiceUnavailableException(
        'UTH AI Assistant identity is unavailable.',
      );
    }

    const ipHash = this.guestIdentity.hashIpAddress(remoteAddress);
    const releaseRateLimit = await this.rateLimit.acquireRequest(
      principal,
      ipHash,
    );
    try {
      const previousContext = readAiAssistantConversationContextToken(
        conversationContextToken,
        this.config.guestCookieSecret,
        principal,
      );
      const decision = this.scopePolicy.classify(message, previousContext);
      if (decision.scope === AiAssistantScope.OUT_OF_SCOPE) {
        this.logger.log(
          'AI Assistant response source=internal reason=scope_rejection.',
        );
        return {
          scope: decision.scope,
          answer:
            decision.reason === 'security_refusal'
              ? decision.language === 'vi'
                ? 'Mình chỉ có thể hướng dẫn sử dụng UTH Online Judge và không thể hỗ trợ yêu cầu này. Bạn cần hướng dẫn chức năng nào khác không?'
                : "I can only help with using UTH Online Judge and can't assist with that request. Is there another platform feature you'd like help with?"
              : decision.language === 'vi'
                ? 'Mình là UTH AI Assistant, chuyên hỗ trợ hướng dẫn sử dụng UTH Online Judge. Bạn cần mình giúp gì trên hệ thống không?'
                : "I'm UTH AI Assistant, here to help you use UTH Online Judge. What would you like help with on the platform?",
        };
      }

      if (decision.basicReply) {
        this.logger.log(
          'AI Assistant response source=internal reason=basic_intent.',
        );
        return {
          scope: AiAssistantScope.IN_SCOPE,
          answer: decision.basicReply,
        };
      }

      const matchedGlossary = findAiAssistantGlossaryMatches(message);
      if (decision.scope === AiAssistantScope.UNCERTAIN || !decision.faq) {
        const fallback = this.uncertainResponse(
          decision.language,
          decision.reason === 'sensitive_input',
          decision.clarification === 'problem-topic',
        );
        if (decision.reason || decision.clarification === 'problem-topic') {
          this.logger.log(
            `AI Assistant response source=internal reason=${decision.reason ?? 'clarification'}.`,
          );
          return fallback;
        }

        const faqs = this.getCandidateFaqs([], matchedGlossary);
        const glossary = this.getCandidateGlossary(matchedGlossary, faqs);
        return this.answerQuestion(
          message,
          decision.language,
          faqs,
          glossary,
          principal,
          previousContext,
          decision.responseStyle ?? 'user',
          decision.technicalFocus,
          fallback,
        );
      }

      const faqs = this.getCandidateFaqs(
        decision.faqs ?? [decision.faq],
        matchedGlossary,
      );
      const glossary = this.getCandidateGlossary(matchedGlossary, faqs);
      const intent = decision.conversation?.intent ?? 'faq-guidance';
      const fallbackContext = this.createConversationContext(
        principal,
        intent,
        faqs.map(({ id }) => id),
        previousContext,
      );
      const focusedStatement = decision.technicalFocus
        ? faqs
            .flatMap((faq) => faq.approvedStatements)
            .find(
              (statement) =>
                statement.id ===
                `status-${decision.technicalFocus!.toLowerCase()}`,
            )?.technicalPhrases?.[decision.language][0]
        : undefined;
      const fallback: AiAssistantChatResponse = {
        scope: AiAssistantScope.IN_SCOPE,
        answer:
          focusedStatement ??
          faqs
            .map((faq) =>
              decision.responseStyle === 'technical'
                ? (faq.technicalAnswer?.[decision.language] ??
                  faq.answer[decision.language])
                : faq.answer[decision.language],
            )
            .join('\n\n'),
        ...(fallbackContext ? { conversationContext: fallbackContext } : {}),
      };
      return this.answerQuestion(
        message,
        decision.language,
        faqs,
        glossary,
        principal,
        previousContext,
        decision.responseStyle ?? 'user',
        decision.technicalFocus,
        fallback,
        intent,
      );
    } finally {
      await releaseRateLimit();
    }
  }

  private uncertainResponse(
    language: 'vi' | 'en',
    sensitive = false,
    problemTopic = false,
  ): AiAssistantChatResponse {
    return {
      scope: AiAssistantScope.UNCERTAIN,
      answer: sensitive
        ? language === 'vi'
          ? 'Vui lòng không gửi email, mật khẩu, mã truy cập hoặc thông tin cá nhân. Bạn có thể hỏi lại chỉ về chức năng của UTH Online Judge.'
          : 'Please do not include email addresses, passwords, access tokens, or personal information. Ask only about a UTH Online Judge feature.'
        : problemTopic
          ? language === 'vi'
            ? 'Bạn muốn tìm bài tập, xem đề bài, nộp bài hay xem kết quả chấm?'
            : 'Do you want to find problems, read a statement, submit a solution, or view judging results?'
          : language === 'vi'
            ? 'Mình có thể hướng dẫn bạn tìm bài tập, nộp bài và xem kết quả chấm trên UTH Online Judge. Bạn đang cần hỗ trợ chức năng nào?'
            : 'I can help you find problems, submit solutions, and view judging results on UTH Online Judge. Which feature do you need help with?',
    };
  }

  private getCandidateFaqs(
    matchedFaqs: readonly AiAssistantFaqEntry[],
    glossaryMatches: readonly AiAssistantGlossaryEntry[],
  ): AiAssistantFaqEntry[] {
    const ids = new Set([
      ...matchedFaqs.map(({ id }) => id),
      ...glossaryMatches.map(({ faqId }) => faqId),
    ]);
    if (ids.size === 0) return [...AI_ASSISTANT_FAQ];
    return AI_ASSISTANT_FAQ.filter(({ id }) => ids.has(id));
  }

  private getCandidateGlossary(
    matches: readonly AiAssistantGlossaryEntry[],
    faqs: readonly AiAssistantFaqEntry[],
  ): AiAssistantGlossaryEntry[] {
    const faqIds = new Set(faqs.map(({ id }) => id));
    return matches.filter(({ faqId }) => faqIds.has(faqId));
  }

  private async answerQuestion(
    question: string,
    language: 'vi' | 'en',
    faqs: readonly AiAssistantFaqEntry[],
    glossary: readonly AiAssistantGlossaryEntry[],
    principal: AiAssistantPrincipal,
    previousContext: ReturnType<typeof readAiAssistantConversationContextToken>,
    responseStyle: AiAssistantResponseStyle,
    technicalFocus: AiAssistantTechnicalFocus | undefined,
    fallback: AiAssistantChatResponse,
    preferredIntent?: AiAssistantConversationIntent,
  ): Promise<AiAssistantChatResponse> {
    if (!this.config.apiKey || !this.config.model) {
      this.logger.log(
        'AI Assistant response source=internal reason=provider_unconfigured.',
      );
      return fallback;
    }

    const releaseProvider = await this.rateLimit.reserveProviderAttempt();
    try {
      const completion = await this.openRouter.answerQuestion(
        question,
        faqs,
        glossary,
        language,
        previousContext,
        responseStyle,
        technicalFocus,
      );
      this.logUsage(completion.usage);

      const result = this.outputPolicy.validateGeneratedResponse(
        completion,
        faqs,
        glossary,
        language,
        responseStyle,
        technicalFocus,
      );
      if (!result.accepted) {
        this.logger.warn(
          `AI Assistant provider response rejected stage=${result.stage} reason=${result.reason} finishReason=${getLoggableFinishReason(completion.finishReason)}.`,
        );
        return fallback;
      }

      const selectedFaqs = result.faqIds
        .map((id) => AI_ASSISTANT_FAQ.find((faq) => faq.id === id))
        .filter((faq): faq is AiAssistantFaqEntry => faq !== undefined);
      if (selectedFaqs.length !== result.faqIds.length) {
        this.logger.warn(
          'AI Assistant response source=fallback reason=invalid_selected_faq.',
        );
        return fallback;
      }

      const intent =
        preferredIntent ??
        this.getResolvedConversationIntent(selectedFaqs, previousContext);
      const conversationContext = this.createConversationContext(
        principal,
        intent,
        result.faqIds,
        previousContext,
      );
      this.logger.log(
        `AI Assistant response source=provider faqCount=${result.faqIds.length} glossaryCount=${result.glossaryIds.length} finishReason=${getLoggableFinishReason(completion.finishReason)}.`,
      );
      return {
        scope: AiAssistantScope.IN_SCOPE,
        answer: result.answer,
        ...(conversationContext ? { conversationContext } : {}),
      };
    } catch (error) {
      if (!(error instanceof OpenRouterProviderError)) throw error;
      this.logger.warn(
        `AI Assistant provider request failed stage=request reason=${error.kind} status=${error.statusCode ?? 'n/a'}.`,
      );
      return fallback;
    } finally {
      await releaseProvider();
    }
  }

  private createConversationContext(
    principal: AiAssistantPrincipal,
    intent: AiAssistantConversationIntent,
    faqIds: readonly AiAssistantFaqId[],
    previousContext?: ReturnType<
      typeof readAiAssistantConversationContextToken
    >,
  ): string | undefined {
    const continued =
      previousContext?.faqIds.some((faqId) => faqIds.includes(faqId)) ?? false;
    return createAiAssistantConversationContextToken(
      this.config.guestCookieSecret,
      principal,
      { intent, faqIds, continued },
      continued ? previousContext : undefined,
    );
  }

  private getResolvedConversationIntent(
    faqs: readonly AiAssistantFaqEntry[],
    previousContext?: ReturnType<
      typeof readAiAssistantConversationContextToken
    >,
  ): AiAssistantConversationIntent {
    const faqIds = faqs.map(({ id }) => id);
    if (
      previousContext &&
      previousContext.faqIds.some((faqId) => faqIds.includes(faqId))
    ) {
      return previousContext.intent;
    }
    if (
      previousContext?.intent === 'problem-workflow' &&
      faqIds.every((faqId) =>
        [
          'submission-history',
          'submission-statuses',
          'submit-problem',
        ].includes(faqId),
      )
    ) {
      return 'submission-results';
    }
    return 'faq-guidance';
  }

  private logUsage(
    usage:
      | {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          costUsd?: number;
        }
      | undefined,
  ): void {
    if (!usage) return;
    this.logger.log(
      `OpenRouter usage input=${usage.inputTokens ?? 'n/a'} output=${usage.outputTokens ?? 'n/a'} total=${usage.totalTokens ?? 'n/a'} costUsd=${usage.costUsd ?? 'n/a'}.`,
    );
  }
}
