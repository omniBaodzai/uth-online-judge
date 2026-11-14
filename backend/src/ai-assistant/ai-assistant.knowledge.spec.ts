import { AI_ASSISTANT_FAQ } from './ai-assistant.knowledge.js';
import type {
  AiAssistantFaqTopic,
  AiAssistantLanguage,
} from './ai-assistant.types.js';

const faqTopics: readonly AiAssistantFaqTopic[] = [
  'account',
  'profile',
  'problems',
  'submissions',
  'contests',
  'leaderboard',
  'organizations',
  'discussions',
  'notifications',
];
const languages: readonly AiAssistantLanguage[] = ['vi', 'en'];

describe('AiAssistant knowledge base', () => {
  it('keeps FAQ IDs unique and entries complete in both languages', () => {
    const ids = AI_ASSISTANT_FAQ.map(({ id }) => id);
    expect(ids).toHaveLength(17);
    expect(new Set(ids).size).toBe(ids.length);

    for (const faq of AI_ASSISTANT_FAQ) {
      expect(faqTopics).toContain(faq.topic);
      expect(faq.sources.length).toBeGreaterThan(0);
      expect(faq.approvedStatements.length).toBeGreaterThan(0);
      expect(faq.allowedRoutes.every((route) => route.startsWith('/'))).toBe(
        true,
      );

      const statementIds = faq.approvedStatements.map(({ id }) => id);
      expect(new Set(statementIds).size).toBe(statementIds.length);

      for (const language of languages) {
        expect(faq.question[language].trim()).not.toBe('');
        expect(faq.answer[language].trim()).not.toBe('');
        for (const statement of faq.approvedStatements) {
          expect(statement.phrases[language].length).toBeGreaterThan(0);
          expect(
            statement.phrases[language].every((phrase) => phrase.trim() !== ''),
          ).toBe(true);
        }
      }
    }
  });
});
