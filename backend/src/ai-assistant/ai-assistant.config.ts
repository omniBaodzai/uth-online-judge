import { ServiceUnavailableException } from '@nestjs/common';

export const AI_ASSISTANT_CONFIG = Symbol('AI_ASSISTANT_CONFIG');
export const OPENROUTER_FETCH = Symbol('OPENROUTER_FETCH');

export type AiAssistantConfig = {
  enabled: boolean;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  guestCookieSecret: string;
  guestCookieTtlSeconds: number;
  guestCookieSecure: boolean;
  guestRequestsPerMinute: number;
  guestRequestsPerHour: number;
  userRequestsPerMinute: number;
  identityConcurrency: number;
  ipRequestsPerMinute: number;
  globalRequestsPerMinute: number;
  globalProviderConcurrency: number;
  providerDailyAttempts: number;
};

function parseBoolean(name: string, value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

function parseInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function parseOptionalBoolean(
  name: string,
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return parseBoolean(name, value);
}

export function loadAiAssistantConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiAssistantConfig {
  return {
    enabled: parseBoolean('AI_ASSISTANT_ENABLED', env.AI_ASSISTANT_ENABLED),
    apiKey: env.OPENROUTER_API_KEY?.trim() ?? '',
    model: env.OPENROUTER_MODEL?.trim() ?? '',
    timeoutMs: parseInteger(
      'AI_ASSISTANT_TIMEOUT_MS',
      env.AI_ASSISTANT_TIMEOUT_MS,
      15_000,
      500,
      60_000,
    ),
    maxOutputTokens: parseInteger(
      'AI_ASSISTANT_MAX_OUTPUT_TOKENS',
      env.AI_ASSISTANT_MAX_OUTPUT_TOKENS,
      400,
      1,
      2_048,
    ),
    guestCookieSecret: env.AI_ASSISTANT_GUEST_COOKIE_SECRET?.trim() ?? '',
    guestCookieTtlSeconds: parseInteger(
      'AI_ASSISTANT_GUEST_COOKIE_TTL_SECONDS',
      env.AI_ASSISTANT_GUEST_COOKIE_TTL_SECONDS,
      86_400,
      300,
      604_800,
    ),
    guestCookieSecure: parseOptionalBoolean(
      'AI_ASSISTANT_GUEST_COOKIE_SECURE',
      env.AI_ASSISTANT_GUEST_COOKIE_SECURE,
      env.NODE_ENV === 'production',
    ),
    guestRequestsPerMinute: parseInteger(
      'AI_ASSISTANT_GUEST_REQUESTS_PER_MINUTE',
      env.AI_ASSISTANT_GUEST_REQUESTS_PER_MINUTE,
      10,
      1,
      60,
    ),
    guestRequestsPerHour: parseInteger(
      'AI_ASSISTANT_GUEST_REQUESTS_PER_HOUR',
      env.AI_ASSISTANT_GUEST_REQUESTS_PER_HOUR,
      60,
      1,
      1_440,
    ),
    userRequestsPerMinute: parseInteger(
      'AI_ASSISTANT_USER_REQUESTS_PER_MINUTE',
      env.AI_ASSISTANT_USER_REQUESTS_PER_MINUTE,
      20,
      1,
      120,
    ),
    identityConcurrency: parseInteger(
      'AI_ASSISTANT_IDENTITY_CONCURRENCY',
      env.AI_ASSISTANT_IDENTITY_CONCURRENCY,
      1,
      1,
      10,
    ),
    ipRequestsPerMinute: parseInteger(
      'AI_ASSISTANT_IP_REQUESTS_PER_MINUTE',
      env.AI_ASSISTANT_IP_REQUESTS_PER_MINUTE,
      300,
      1,
      10_000,
    ),
    globalRequestsPerMinute: parseInteger(
      'AI_ASSISTANT_GLOBAL_REQUESTS_PER_MINUTE',
      env.AI_ASSISTANT_GLOBAL_REQUESTS_PER_MINUTE,
      300,
      1,
      100_000,
    ),
    globalProviderConcurrency: parseInteger(
      'AI_ASSISTANT_GLOBAL_PROVIDER_CONCURRENCY',
      env.AI_ASSISTANT_GLOBAL_PROVIDER_CONCURRENCY,
      4,
      1,
      100,
    ),
    providerDailyAttempts: parseInteger(
      'AI_ASSISTANT_PROVIDER_DAILY_ATTEMPTS',
      env.AI_ASSISTANT_PROVIDER_DAILY_ATTEMPTS,
      200,
      1,
      100_000,
    ),
  };
}

export function assertOpenRouterConfigured(config: AiAssistantConfig): void {
  if (!config.enabled) {
    throw new ServiceUnavailableException('UTH AI Assistant is disabled.');
  }
  if (!config.apiKey || !config.model) {
    throw new ServiceUnavailableException(
      'OpenRouter credentials and model are not configured.',
    );
  }
}
