import {
  detectAiAssistantLanguage,
  matchBasicConversation,
  matchFaqIntent,
  normalizeAiAssistantQuestion,
} from './ai-assistant.intent-matcher.js';

describe('AiAssistant intent normalization and basic conversation', () => {
  it.each([
    ['  LÀM   SAO nộp bài??? ', 'lam sao nop bai'],
    ['Chào bạn!!!', 'chao ban'],
    ['ＨＥＬＬＯ', 'hello'],
    ['I cannot log in.', 'i cannot log in'],
  ])(
    'normalizes %j without removing intent-bearing words',
    (input, expected) => {
      expect(normalizeAiAssistantQuestion(input)).toBe(expected);
    },
  );

  it.each([
    ['Chao ban', 'vi'],
    ['Làm sao nộp bài?', 'vi'],
    ['How do I submit a solution?', 'en'],
    ['What is the weather today?', 'en'],
    ['Will it rain tomorrow?', 'en'],
    ['The contest is today', 'en'],
    ['On the problems page', 'en'],
    ['Hom nay troi mua khong?', 'vi'],
    ['Ban la ai?', 'vi'],
    ['How do I search for bài tập?', 'en'],
    ['Làm sao search bài tập?', 'vi'],
  ] as const)('detects the language of %j', (input, expected) => {
    const normalized = normalizeAiAssistantQuestion(input);
    expect(detectAiAssistantLanguage(input, normalized)).toBe(expected);
  });

  it.each([
    ['Xin chào', 'vi', 'GREETING'],
    ['Thanks!', 'en', 'THANKS'],
    ['Tam biet', 'vi', 'GOODBYE'],
    ['What can you do?', 'en', 'CAPABILITIES'],
    ['Ban la ai?', 'vi', 'BOT_IDENTITY'],
    ['Hello, what can you do?', 'en', 'CAPABILITIES'],
  ] as const)('matches basic conversation %j', (input, language, intent) => {
    const normalized = normalizeAiAssistantQuestion(input);
    expect(matchBasicConversation(normalized, language)?.intent).toBe(intent);
  });

  it.each(['organization', 'leaderboard', 'ranking', 'notifications'])(
    'does not classify a bare topic as a FAQ: %s',
    (input) => {
      expect(matchFaqIntent(normalizeAiAssistantQuestion(input)).kind).toBe(
        'none',
      );
    },
  );

  it.each([
    ['How do I find problems and see submissions?', 'ambiguous'],
    ['How do I view the leaderboard for a contest?', 'matched'],
    ['Global leaderboard', 'matched'],
  ] as const)(
    'uses context to resolve FAQ candidates for %j',
    (input, expectedKind) => {
      expect(matchFaqIntent(normalizeAiAssistantQuestion(input)).kind).toBe(
        expectedKind,
      );
    },
  );
});
