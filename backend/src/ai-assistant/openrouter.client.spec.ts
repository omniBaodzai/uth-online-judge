import { ServiceUnavailableException } from '@nestjs/common';
import type { AiAssistantConfig } from './ai-assistant.config.js';
import {
  AI_ASSISTANT_FAQ,
  AI_ASSISTANT_GLOSSARY,
} from './ai-assistant.knowledge.js';
import {
  OpenRouterClient,
  OpenRouterProviderError,
} from './openrouter.client.js';

const config: AiAssistantConfig = {
  enabled: true,
  apiKey: 'test-api-key',
  model: 'test/model',
  timeoutMs: 2_000,
  maxOutputTokens: 100,
};
const faq = AI_ASSISTANT_FAQ[0]!;
const answerJson = JSON.stringify({
  faqIds: [faq.id],
  glossaryIds: [],
  language: 'en',
  claims: [
    {
      sourceId: `${faq.id}#register-and-sign-in`,
      text: faq.approvedStatements[0]!.phrases.en[0],
    },
  ],
});

function createClient(
  fetcher: typeof fetch,
  override: Partial<AiAssistantConfig> = {},
) {
  return new OpenRouterClient({ ...config, ...override }, fetcher);
}

function getRequestBody(options: RequestInit | undefined): string {
  if (typeof options?.body !== 'string') {
    throw new Error('Expected the provider request body to be JSON text.');
  }
  return options.body;
}

function answerQuestion(
  client: OpenRouterClient,
  fetcherQuestion = 'How do I register?',
) {
  return client.answerQuestion(fetcherQuestion, [faq], [], 'en');
}

describe('OpenRouterClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends one bounded request with the current question and parses metadata', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: answerJson },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 51,
            completion_tokens: 18,
            total_tokens: 69,
            cost: 0.00002,
          },
        }),
      ),
    );
    const client = createClient(fetcher);

    await expect(answerQuestion(client)).resolves.toEqual({
      content: answerJson,
      finishReason: 'stop',
      usage: {
        inputTokens: 51,
        outputTokens: 18,
        totalTokens: 69,
        costUsd: 0.00002,
      },
    });

    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer test-api-key',
      'Content-Type': 'application/json',
    });
    const requestBody = options?.body;
    if (typeof requestBody !== 'string')
      throw new Error('Expected a JSON request body.');
    const body = JSON.parse(requestBody) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'test/model',
      max_tokens: 100,
      stream: false,
    });
    const messages = body.messages as Array<{
      role: string;
      content: string;
    }>;
    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toContain('Treat the user question');
    const prompt = JSON.parse(messages[1]!.content) as {
      userQuestion: string;
      candidateFaqs: Array<{
        id: string;
        facts: Array<{ sourceId: string; evidence: string[] }>;
      }>;
    };
    expect(prompt.userQuestion).toBe('How do I register?');
    expect(prompt.candidateFaqs).toHaveLength(1);
    expect(prompt.candidateFaqs[0]?.id).toBe(faq.id);
    expect(prompt.candidateFaqs[0]?.facts[0]).toEqual({
      sourceId: `${faq.id}#register-and-sign-in`,
      evidence: faq.approvedStatements[0]!.phrases.en,
    });
    expect(JSON.stringify(prompt)).not.toContain('apiKey');
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('response_format');
  });

  it('sends minimal signed context and matched glossary facts without identity data', async () => {
    const statusFaq = AI_ASSISTANT_FAQ.find(
      ({ id }) => id === 'submission-statuses',
    )!;
    const glossary = AI_ASSISTANT_GLOSSARY.find(({ id }) => id === 'AC')!;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: answerJson }, finish_reason: 'stop' },
          ],
        }),
      ),
    );
    const client = createClient(fetcher);

    await client.answerQuestion(
      'AC nghĩa là gì?',
      [statusFaq],
      [glossary],
      'vi',
      {
        intent: 'submission-results',
        faqIds: ['submission-statuses'],
      },
    );

    const [, options] = fetcher.mock.calls[0]!;
    const body = JSON.parse(getRequestBody(options)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const prompt = JSON.parse(body.messages[1]!.content) as Record<
      string,
      unknown
    >;
    expect(prompt).toMatchObject({
      userQuestion: 'AC nghĩa là gì?',
      responseLanguage: 'vi',
      priorContext: {
        intent: 'submission-results',
        faqIds: ['submission-statuses'],
      },
      glossary: [
        expect.objectContaining({
          id: 'AC',
          sourceId: 'glossary:AC',
          faqId: 'submission-statuses',
        }),
      ],
    });
    expect(JSON.stringify(prompt)).not.toContain('guest-id');
    expect(JSON.stringify(prompt)).not.toContain('conversationContext');
  });

  it.each([
    { status: 401, kind: 'authentication' },
    { status: 402, kind: 'payment_required' },
    { status: 429, kind: 'rate_limited' },
    { status: 500, kind: 'server' },
  ] as const)(
    'classifies provider HTTP status $status without exposing its body',
    async ({ status, kind }) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('provider detail with secret', { status }),
        );
      await expect(answerQuestion(createClient(fetcher))).rejects.toMatchObject(
        { kind, statusCode: status },
      );
    },
  );

  it('identifies malformed provider JSON without exposing its contents', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not json'));
    await expect(answerQuestion(createClient(fetcher))).resolves.toEqual({
      content: undefined,
      finishReason: undefined,
      responseIssue: 'invalid_provider_json',
    });
  });

  it.each([
    { label: 'missing choices', payload: {} },
    { label: 'empty choices', payload: { choices: [] } },
    { label: 'missing message', payload: { choices: [{}] } },
  ])('identifies provider envelopes with $label', async ({ payload }) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(payload)));
    await expect(answerQuestion(createClient(fetcher))).resolves.toMatchObject({
      responseIssue: 'invalid_provider_envelope',
    });
  });

  it('preserves empty provider content and missing finish metadata for classification', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: null } }],
        }),
      ),
    );
    await expect(answerQuestion(createClient(fetcher))).resolves.toEqual({
      content: null,
      finishReason: undefined,
    });
  });

  it('keeps malformed choice content available only for output-policy rejection', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 3 }, finish_reason: 'stop' }],
        }),
      ),
    );
    await expect(answerQuestion(createClient(fetcher))).resolves.toEqual({
      content: 3,
      finishReason: 'stop',
    });
  });

  it('ignores malformed and negative usage values', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: answerJson }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: -1, completion_tokens: '2', cost: null },
        }),
      ),
    );
    await expect(answerQuestion(createClient(fetcher))).resolves.toEqual({
      content: answerJson,
      finishReason: 'stop',
    });
  });

  it('rejects missing credentials before making a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createClient(fetcher, { apiKey: '' });
    await expect(answerQuestion(client)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sanitizes network failures and does not retry', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('private network details'));
    await expect(answerQuestion(createClient(fetcher))).rejects.toMatchObject({
      kind: 'network',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('converts an aborted fetch to a sanitized timeout error', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const request = answerQuestion(
      createClient(fetcher, { timeoutMs: 500 }),
    ).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(500);
    expect(await request).toMatchObject({ kind: 'timeout' });
    expect(await request).toBeInstanceOf(OpenRouterProviderError);
  });
});
