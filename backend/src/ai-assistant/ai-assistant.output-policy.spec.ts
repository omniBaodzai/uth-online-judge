import {
  AI_ASSISTANT_FAQ,
  AI_ASSISTANT_GLOSSARY,
} from './ai-assistant.knowledge.js';
import { AiAssistantOutputPolicy } from './ai-assistant.output-policy.js';
import type { AiAssistantFaqEntry } from './ai-assistant.types.js';
import type { OpenRouterCompletion } from './openrouter.client.js';

const policy = new AiAssistantOutputPolicy();
const problemSearch = AI_ASSISTANT_FAQ.find(
  ({ id }) => id === 'problem-search',
)!;
const submissionStatuses = AI_ASSISTANT_FAQ.find(
  ({ id }) => id === 'submission-statuses',
)!;
const glossaryAc = AI_ASSISTANT_GLOSSARY.find(({ id }) => id === 'AC')!;

function completion(
  value: unknown,
  finishReason: unknown = 'stop',
): OpenRouterCompletion {
  return {
    content: typeof value === 'string' ? value : JSON.stringify(value),
    finishReason,
  };
}

function response(
  faqIds: string[],
  claims: Array<{ sourceId: string; text: string }>,
  options: {
    glossaryIds?: string[];
    language?: string;
  } = {},
) {
  return {
    faqIds,
    glossaryIds: options.glossaryIds ?? [],
    language: options.language ?? 'en',
    claims,
  };
}

function validate(
  value: unknown,
  candidates: readonly AiAssistantFaqEntry[] = [problemSearch],
  glossary = [] as (typeof AI_ASSISTANT_GLOSSARY)[number][],
  language: 'vi' | 'en' = 'en',
  responseStyle: 'user' | 'technical' = 'user',
  technicalFocus?: 'PENDING' | 'QUEUED' | 'RUNNING',
) {
  return policy.validateGeneratedResponse(
    completion(value),
    candidates,
    glossary,
    language,
    responseStyle,
    technicalFocus,
  );
}

function validateCompletion(value: OpenRouterCompletion) {
  return policy.validateGeneratedResponse(
    value,
    [problemSearch],
    [],
    'en',
    'user',
  );
}

describe('AiAssistantOutputPolicy', () => {
  it('accepts a natural paraphrase grounded in a selected FAQ fact', () => {
    const text = 'Open Problems to browse the list.';
    expect(
      validate(
        response(
          ['problem-search'],
          [
            {
              sourceId: 'problem-search#published-problem-list',
              text,
            },
          ],
        ),
      ),
    ).toEqual({
      accepted: true,
      answer: text,
      faqIds: ['problem-search'],
      glossaryIds: [],
    });
  });

  it('accepts an abbreviation explanation only with its linked glossary and FAQ', () => {
    const text = 'AC is short for Accepted; your solution has been accepted.';
    expect(
      validate(
        response(['submission-statuses'], [{ sourceId: 'glossary:AC', text }], {
          glossaryIds: ['AC'],
        }),
        [submissionStatuses],
        [glossaryAc],
      ),
    ).toMatchObject({
      accepted: true,
      answer: text,
      faqIds: ['submission-statuses'],
      glossaryIds: ['AC'],
    });
  });

  it('rejects unknown IDs, unsupported facts, and unlinked glossary entries', () => {
    expect(
      validate(
        response(
          ['unknown-faq'],
          [
            {
              sourceId: 'problem-search#published-problem-list',
              text: 'Open Problems to browse the list.',
            },
          ],
        ),
      ),
    ).toMatchObject({ accepted: false, reason: 'invalid_faq_selection' });

    expect(
      validate(
        response(
          ['problem-search'],
          [
            {
              sourceId: 'problem-search#invented-feature',
              text: 'Open Problems.',
            },
          ],
        ),
      ),
    ).toMatchObject({
      accepted: false,
      stage: 'output_policy',
      reason: 'invalid_source_id',
    });

    expect(
      validate(
        response(
          ['problem-search'],
          [{ sourceId: 'glossary:AC', text: 'AC means accepted.' }],
          { glossaryIds: ['AC'] },
        ),
        [problemSearch],
        [glossaryAc],
      ),
    ).toMatchObject({
      accepted: false,
      stage: 'output_policy',
      reason: 'invalid_glossary_selection',
    });
  });

  it('rejects paraphrases with insufficient overlap with cited facts', () => {
    expect(
      validate(
        response(
          ['problem-search'],
          [
            {
              sourceId: 'problem-search#published-problem-list',
              text: 'Purchase premium credits in the account store.',
            },
          ],
        ),
      ),
    ).toMatchObject({ accepted: false, reason: 'unsupported_claim' });
  });

  it('rejects routes that are not in the selected FAQ', () => {
    expect(
      validate(
        response(
          ['problem-search'],
          [
            {
              sourceId: 'problem-search#published-problem-list',
              text: 'Browse published problems at /admin/users.',
            },
          ],
        ),
        [problemSearch],
        [],
        'en',
        'technical',
      ),
    ).toMatchObject({ accepted: false, reason: 'unsupported_route' });
  });

  it.each([
    ['code', 'Here is code: ```ts\\nconst x = 1;\\n```', 'code_content'],
    ['secret', 'Use this API key: sk-or-v1-1234567890abcdef', 'secret_content'],
    ['email', 'Send the result to student@example.com.', 'secret_content'],
    [
      'out-of-scope',
      'Here is the algorithm implementation.',
      'out_of_scope_content',
    ],
  ] as const)('rejects unsafe generated %s content', (_name, text, reason) => {
    expect(
      validate(
        response(
          ['problem-search'],
          [
            {
              sourceId: 'problem-search#published-problem-list',
              text,
            },
          ],
        ),
      ),
    ).toMatchObject({ accepted: false, reason });
  });

  it('rejects a claim that is outside the focused status', () => {
    expect(
      validate(
        response(
          ['submission-statuses'],
          [
            {
              sourceId: 'submission-statuses#status-accepted',
              text: 'Your submission has been accepted.',
            },
          ],
        ),
        [submissionStatuses],
        [],
        'en',
        'technical',
        'QUEUED',
      ),
    ).toMatchObject({ accepted: false, reason: 'unsupported_claim' });
  });

  it('rejects a mismatched response language and empty knowledge selection', () => {
    const claim = {
      sourceId: 'problem-search#published-problem-list',
      text: 'Open Problems to browse the list.',
    };
    expect(
      validate(response(['problem-search'], [claim], { language: 'vi' })),
    ).toMatchObject({
      accepted: false,
      stage: 'output_policy',
      reason: 'language_mismatch',
    });
    expect(validate(response([], []))).toMatchObject({
      accepted: false,
      reason: 'invalid_faq_selection',
    });
  });

  it('rejects invalid JSON', () => {
    expect(
      policy.validateGeneratedResponse(
        { content: 'not JSON', finishReason: 'stop' },
        [problemSearch],
        [],
        'en',
        'user',
      ),
    ).toMatchObject({
      accepted: false,
      stage: 'parsing',
      reason: 'invalid_json',
    });
  });

  it.each([
    {
      label: 'Markdown-wrapped JSON',
      content: '```json\n{"faqIds":[]}\n```',
    },
    {
      label: 'text surrounding JSON',
      content: 'Answer: {"faqIds":[]} Done.',
    },
    {
      label: 'truncated JSON with a normal finish reason',
      content: '{"faqIds":["problem-search"],',
    },
  ])('classifies $label as invalid JSON', ({ content }) => {
    expect(validateCompletion({ content, finishReason: 'stop' })).toMatchObject(
      {
        accepted: false,
        stage: 'parsing',
        reason: 'invalid_json',
      },
    );
  });

  it.each([
    {
      label: 'empty content',
      completion: { content: '', finishReason: 'stop' },
      stage: 'completion',
      reason: 'empty_response',
    },
    {
      label: 'null content',
      completion: { content: null, finishReason: 'stop' },
      stage: 'completion',
      reason: 'empty_response',
    },
    {
      label: 'missing finish reason',
      completion: { content: '{}', finishReason: undefined },
      stage: 'completion',
      reason: 'incomplete_response',
    },
    {
      label: 'unexpected finish reason',
      completion: { content: '{}', finishReason: 'content_filter' },
      stage: 'completion',
      reason: 'unexpected_finish_reason',
    },
    {
      label: 'length-limited content',
      completion: { content: '{"faqIds":[', finishReason: 'length' },
      stage: 'completion',
      reason: 'incomplete_response',
    },
  ] as const)(
    'classifies $label before schema validation',
    ({ completion: providerCompletion, stage, reason }) => {
      expect(validateCompletion(providerCompletion)).toMatchObject({
        accepted: false,
        stage,
        reason,
      });
    },
  );

  it.each([
    {
      label: 'malformed provider JSON',
      responseIssue: 'invalid_provider_json',
    },
    {
      label: 'malformed provider envelope',
      responseIssue: 'invalid_provider_envelope',
    },
  ] as const)(
    'classifies $label separately from model output',
    ({ responseIssue }) => {
      expect(
        validateCompletion({
          content: undefined,
          finishReason: undefined,
          responseIssue,
        }),
      ).toMatchObject({
        accepted: false,
        stage: 'provider_envelope',
        reason: responseIssue,
      });
    },
  );

  it.each([
    {
      label: 'missing required field',
      value: {
        faqIds: ['problem-search'],
        glossaryIds: [],
        language: 'en',
      },
      reason: 'missing_required_field',
    },
    {
      label: 'unknown top-level field',
      value: {
        ...response(
          ['problem-search'],
          [
            {
              sourceId: 'problem-search#published-problem-list',
              text: 'Open Problems to browse the list.',
            },
          ],
        ),
        confidence: 1,
      },
      reason: 'unknown_field',
    },
    {
      label: 'invalid claims type',
      value: {
        faqIds: ['problem-search'],
        glossaryIds: [],
        language: 'en',
        claims: 'not-an-array',
      },
      reason: 'invalid_field_type',
    },
    {
      label: 'empty claims array',
      value: {
        faqIds: ['problem-search'],
        glossaryIds: [],
        language: 'en',
        claims: [],
      },
      reason: 'empty_claims',
    },
    {
      label: 'non-object claim',
      value: {
        faqIds: ['problem-search'],
        glossaryIds: [],
        language: 'en',
        claims: [null],
      },
      reason: 'invalid_claim_shape',
    },
    {
      label: 'missing sourceId',
      value: {
        faqIds: ['problem-search'],
        glossaryIds: [],
        language: 'en',
        claims: [{ text: 'Open Problems to browse the list.' }],
      },
      reason: 'missing_source_id',
    },
    {
      label: 'invalid sourceId type',
      value: {
        faqIds: ['problem-search'],
        glossaryIds: [],
        language: 'en',
        claims: [
          {
            sourceId: 7,
            text: 'Open Problems to browse the list.',
          },
        ],
      },
      reason: 'invalid_claim_type',
    },
  ] as const)('classifies schema failure: $label', ({ value, reason }) => {
    expect(
      validateCompletion({
        content: JSON.stringify(value),
        finishReason: 'stop',
      }),
    ).toMatchObject({
      accepted: false,
      stage: 'schema_validation',
      reason,
    });
  });

  it('rejects claims with invalid structure', () => {
    const content = JSON.stringify({
      faqIds: ['problem-search'],
      glossaryIds: [],
      language: 'en',
      claims: [{ sourceId: 'problem-search#published-problem-list', text: 5 }],
    });
    expect(
      policy.validateGeneratedResponse(
        { content, finishReason: 'stop' },
        [problemSearch],
        [],
        'en',
        'user',
      ),
    ).toMatchObject({
      accepted: false,
      stage: 'schema_validation',
      reason: 'invalid_claim_type',
    });
  });

  it('rejects unfinished provider output', () => {
    expect(
      policy.validateGeneratedResponse(
        completion(
          response(
            ['problem-search'],
            [
              {
                sourceId: 'problem-search#published-problem-list',
                text: 'Open Problems to browse the list.',
              },
            ],
          ),
          'length',
        ),
        [problemSearch],
        [],
        'en',
        'user',
      ),
    ).toMatchObject({
      accepted: false,
      stage: 'completion',
      reason: 'incomplete_response',
    });
  });
});
