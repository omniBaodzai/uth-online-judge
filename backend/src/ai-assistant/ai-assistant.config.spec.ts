import { ServiceUnavailableException } from '@nestjs/common';
import {
  assertOpenRouterConfigured,
  loadAiAssistantConfig,
} from './ai-assistant.config.js';

describe('AI assistant configuration', () => {
  it('is disabled by default and has bounded provider defaults', () => {
    expect(loadAiAssistantConfig({})).toEqual({
      enabled: false,
      apiKey: '',
      model: '',
      timeoutMs: 15_000,
      maxOutputTokens: 400,
      guestCookieSecret: '',
      guestCookieTtlSeconds: 86_400,
      guestCookieSecure: false,
      guestRequestsPerMinute: 10,
      guestRequestsPerHour: 60,
      userRequestsPerMinute: 20,
      identityConcurrency: 1,
      ipRequestsPerMinute: 300,
      globalRequestsPerMinute: 300,
      globalProviderConcurrency: 4,
      providerDailyAttempts: 200,
    });
  });

  it('rejects invalid feature-flag and resource-limit values', () => {
    expect(() => loadAiAssistantConfig({ AI_ASSISTANT_ENABLED: 'yes' }))
      .toThrow('AI_ASSISTANT_ENABLED must be true or false.');
    expect(() =>
      loadAiAssistantConfig({ AI_ASSISTANT_MAX_OUTPUT_TOKENS: '2049' }),
    ).toThrow('AI_ASSISTANT_MAX_OUTPUT_TOKENS must be an integer between 1 and 2048.');
    expect(() =>
      loadAiAssistantConfig({ AI_ASSISTANT_PROVIDER_DAILY_ATTEMPTS: '0' }),
    ).toThrow(
      'AI_ASSISTANT_PROVIDER_DAILY_ATTEMPTS must be an integer between 1 and 100000.',
    );
    expect(
      loadAiAssistantConfig({
        NODE_ENV: 'production',
      }).guestCookieSecure,
    ).toBe(true);
  });

  it('requires an enabled feature and provider configuration', () => {
    const config = loadAiAssistantConfig({
      AI_ASSISTANT_ENABLED: 'true',
      OPENROUTER_API_KEY: 'test-key',
      OPENROUTER_MODEL: 'test/model',
    });
    expect(() => assertOpenRouterConfigured(config)).not.toThrow();
    expect(() =>
      assertOpenRouterConfigured({ ...config, apiKey: '' }),
    ).toThrow(ServiceUnavailableException);
  });
});
