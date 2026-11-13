import { Inject, Injectable } from '@nestjs/common';
import {
  AI_ASSISTANT_CONFIG,
  OPENROUTER_FETCH,
  assertOpenRouterConfigured,
  type AiAssistantConfig,
} from './ai-assistant.config.js';
import type {
  AiAssistantConversationContext,
  AiAssistantFaqEntry,
  AiAssistantGlossaryEntry,
  AiAssistantLanguage,
  AiAssistantResponseStyle,
  AiAssistantTechnicalFocus,
} from './ai-assistant.types.js';
import {
  createAiAssistantAnswerPrompt,
  AI_ASSISTANT_SYSTEM_PROMPT,
} from './ai-assistant.prompt.js';

const OPENROUTER_CHAT_COMPLETIONS_URL =
  'https://openrouter.ai/api/v1/chat/completions';

export type OpenRouterErrorKind =
  | 'timeout'
  | 'network'
  | 'authentication'
  | 'payment_required'
  | 'rate_limited'
  | 'server'
  | 'http';

export type OpenRouterUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
};

export type OpenRouterResponseIssue =
  'invalid_provider_json' | 'invalid_provider_envelope';

export type OpenRouterCompletion = {
  content: unknown;
  finishReason: unknown;
  responseIssue?: OpenRouterResponseIssue;
  usage?: OpenRouterUsage;
};

export class OpenRouterProviderError extends Error {
  constructor(
    readonly kind: OpenRouterErrorKind,
    readonly statusCode?: number,
  ) {
    super(`OpenRouter request failed (${kind}).`);
    this.name = 'OpenRouterProviderError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function parseUsage(value: unknown): OpenRouterUsage | undefined {
  if (!isRecord(value)) return undefined;
  const usage: OpenRouterUsage = {};
  const inputTokens = nonNegativeNumber(value.prompt_tokens);
  const outputTokens = nonNegativeNumber(value.completion_tokens);
  const totalTokens = nonNegativeNumber(value.total_tokens);
  const costUsd = nonNegativeNumber(value.cost);
  if (inputTokens !== undefined) usage.inputTokens = inputTokens;
  if (outputTokens !== undefined) usage.outputTokens = outputTokens;
  if (totalTokens !== undefined) usage.totalTokens = totalTokens;
  if (costUsd !== undefined) usage.costUsd = costUsd;
  return Object.keys(usage).length > 0 ? usage : undefined;
}

function classifyHttpError(status: number): OpenRouterErrorKind {
  if (status === 401) return 'authentication';
  if (status === 402) return 'payment_required';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'http';
}

@Injectable()
export class OpenRouterClient {
  constructor(
    @Inject(AI_ASSISTANT_CONFIG) private readonly config: AiAssistantConfig,
    @Inject(OPENROUTER_FETCH) private readonly fetcher: typeof fetch,
  ) {}

  async answerQuestion(
    question: string,
    faqs: readonly AiAssistantFaqEntry[],
    glossary: readonly AiAssistantGlossaryEntry[],
    language: AiAssistantLanguage,
    context?: Pick<AiAssistantConversationContext, 'intent' | 'faqIds'>,
    responseStyle: AiAssistantResponseStyle = 'user',
    technicalFocus?: AiAssistantTechnicalFocus,
  ): Promise<OpenRouterCompletion> {
    return this.request([
      { role: 'system', content: AI_ASSISTANT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: createAiAssistantAnswerPrompt(
          question,
          faqs,
          glossary,
          language,
          context,
          responseStyle,
          technicalFocus,
        ),
      },
    ]);
  }

  private async request(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ): Promise<OpenRouterCompletion> {
    assertOpenRouterConfigured(this.config);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      let response: Response;
      try {
        response = await this.fetcher(OPENROUTER_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.config.model,
            messages,
            max_tokens: this.config.maxOutputTokens,
            stream: false,
          }),
        });
      } catch {
        throw new OpenRouterProviderError(
          controller.signal.aborted ? 'timeout' : 'network',
        );
      }

      if (!response.ok) {
        throw new OpenRouterProviderError(
          classifyHttpError(response.status),
          response.status,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        if (controller.signal.aborted) {
          throw new OpenRouterProviderError('timeout');
        }
        return {
          content: undefined,
          finishReason: undefined,
          responseIssue: 'invalid_provider_json',
        };
      }

      const choices =
        isRecord(payload) && Array.isArray(payload.choices)
          ? payload.choices
          : undefined;
      const firstChoice = choices?.[0];
      const message =
        isRecord(firstChoice) && isRecord(firstChoice.message)
          ? firstChoice.message
          : undefined;
      const usage = isRecord(payload) ? parseUsage(payload.usage) : undefined;
      if (!choices || !message) {
        return {
          content: undefined,
          finishReason: isRecord(firstChoice)
            ? firstChoice.finish_reason
            : undefined,
          responseIssue: 'invalid_provider_envelope',
          ...(usage ? { usage } : {}),
        };
      }
      return {
        content: message?.content,
        finishReason: isRecord(firstChoice)
          ? firstChoice.finish_reason
          : undefined,
        ...(usage ? { usage } : {}),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
