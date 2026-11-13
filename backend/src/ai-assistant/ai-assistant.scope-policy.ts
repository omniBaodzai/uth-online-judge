import { Injectable } from '@nestjs/common';
import {
  AiAssistantScope,
  type AiAssistantConversationContext,
  type AiAssistantConversationIntent,
  type AiAssistantFaqEntry,
  type AiAssistantFaqId,
  type AiAssistantResponseStyle,
  type AiAssistantScopeDecision,
  type AiAssistantTechnicalFocus,
} from './ai-assistant.types.js';
import { AI_ASSISTANT_FAQ } from './ai-assistant.knowledge.js';
import {
  detectAiAssistantLanguage,
  HIDDEN_TEST_VISIBILITY_QUESTION,
  matchBasicConversation,
  matchFaqIntent,
  normalizeAiAssistantFuzzyQuestion,
  normalizeAiAssistantQuestion,
} from './ai-assistant.intent-matcher.js';

const UNSAFE_HIDDEN_TEST_REQUEST =
  /\b(?:show|reveal|provide|give|get|obtain|request|receive|list|download|access|see|tiet lo|cho xem|cung cap|tai ve|truy cap)\b.{0,80}\bhidden tests?\b|\bhidden tests?\b.{0,80}\b(?:show|reveal|provide|give|get|obtain|request|receive|list|download|access|see|tiet lo|cho xem|cung cap|tai ve|truy cap)\b/;
const HIDDEN_TEST_CLAUSE_SEPARATORS =
  /\b(?:and|but|also|or|va|nhung|dong thoi)\b|[,;!?]+/u;
const SOLVE_PROBLEM_REQUEST =
  /\b(?:solve|find the answer to)\b.{0,80}\b(?:problem|exercise|task|bai|bai tap|bai toan|de bai)\b|(?<!loi )\bgiai\b.{0,80}\b(?:problem|exercise|task|bai|bai tap|bai toan|de bai)\b/;
const WEBSITE_PROBLEM_WORKFLOW =
  /\b(?:how do i|how to|what is the way to)\b.{0,45}\b(?:solve|do|work on|start)\b.{0,35}\b(?:problems?|exercises?)\b.{0,55}\b(?:website|web|platform|site)\b|\b(?:lam bai tap|cach lam bai(?: tap)?|lam bai tren web|cach giai bai tren web)\b/;
const SUBMISSION_RESULTS_WORKFLOW =
  /\b(?:how do i know|how can i tell|can i tell)\b.{0,40}\b(?:if|whether)\b.{0,35}\b(?:my )?(?:submission|answer|solution|work)\b.{0,35}\b(?:is|was|got|gets)?\s*(?:correct|wrong|accepted|rejected|incorrect)\b|\b(?:how do i know|how can i tell)\b.{0,45}\b(?:my )?(?:submission|answer|solution|work)\b.{0,30}\b(?:is|was|correct|wrong|accepted|rejected|incorrect)\b|\b(?:bai lam|bai nop|bai tap)\b.{0,35}\b(?:dung|sai|ket qua)\b|\b(?:xem|biet)\b.{0,30}\b(?:bai|bai lam|bai nop)\b.{0,35}\b(?:dung|sai|ket qua)\b/;
const PROBLEM_TOPIC_ONLY =
  /^(?:bai tap|bai|problem|problems|exercise|exercises)$/;
const FOLLOW_UP_FAILURE =
  /\b(?:wrong|incorrect|not accepted|failed|sai|khong dung|khong chinh xac)\b/;
const FOLLOW_UP_WHERE =
  /^(?:where|where can i see it|where do i see it|where is it|where can i find it|see it where|xem o dau|xem no o dau|o dau|xem ket qua o dau)$/;
const FOLLOW_UP_MEANING =
  /^(?:what does it mean|what does that mean|what does this mean|nghia la gi|la sao|y nghia la gi)$/;
const TECHNICAL_REQUEST =
  /\b(?:route|url|endpoint|api|http|enum|status code|technical details?)\b|\b(?:duong dan|duong link|ma trang|trang thai|ma trang thai)\b/i;
const STATUS_MEANING_QUESTION =
  /\b(?:means?|meaning of|status|nghia la gi|y nghia|la gi)\b/iu;
const TECHNICAL_STATUSES: readonly AiAssistantTechnicalFocus[] = [
  'PENDING',
  'QUEUED',
  'RUNNING',
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILATION_ERROR',
  'INTERNAL_ERROR',
];

const SECURITY_REFUSAL_REQUESTS = [
  /\b(?:prompt injection|jailbreak(?:ing)?)\b/,
  /\b(?:ignore|bypass|override|forget|disregard)\b.{0,100}\b(?:instructions|rules|system|previous|prompt)\b/,
  /\b(?:bo qua|ghi de|thay doi|xoa bo)\b.{0,100}\b(?:chi thi|huong dan|quy tac|vai tro|prompt)\b/,
  /\b(?:reveal|show|print|disclose|tell me|share)\b.{0,80}\b(?:system prompt|system instructions|api key|secret|credentials)\b/,
  /\b(?:system prompt|system instructions|api key|credentials)\b/,
  /\b(?:tiet lo|cho xem|in ra|chia se)\b.{0,80}\b(?:system prompt|api key|khoa bi mat|secret|thong tin dang nhap)\b/,
  /\b(?:developer mode|developer instructions|act as a developer|you are now a developer|che do developer)\b/,
  /\b(?:write|generate|implement|create|provide|give me|show me|viet|tao|hay viet)\b.{0,100}\b(?:code|solution|program|source code|loi giai|ma nguon|chuong trinh)\b/,
  /\b(?:code|solution|program|source code|loi giai|ma nguon)\b.{0,100}\b(?:write|generate|implement|create|provide|give me|viet|tao|hay viet)\b/,
  /\b(?:debug|fix|repair|troubleshoot|sua loi|go loi)\b.{0,80}\b(?:code|solution|submission|wrong answer|runtime error|ma nguon|bai nop|bai lam)\b/,
  /\b(?:act as|pretend to be|dong vai|hay dong vai)\b.{0,80}\b(?:admin|administrator|different|system|developer|quan tri)\b/,
  /\b(?:show|give|reveal|access|provide|dump|share)\b.{0,50}\b(?:private|personal)\b.{0,25}\b(?:user|account|profile|submission|data)\b/,
  /\b(?:another|other|someone else's|anyone else's)\b.{0,80}\b(?:users?|accounts?|profiles?|submissions?|emails?)\b|\b(?:users?|accounts?|profiles?|submissions?|emails?)\b.{0,80}\b(?:of another user|belonging to someone else|of other users)\b/,
  /\b(?:tai khoan|ho so|bai nop|email|thong tin)\b.{0,60}\b(?:nguoi khac|nguoi dung khac|tai khoan khac)\b|\b(?:nguoi khac|nguoi dung khac)\b.{0,60}\b(?:tai khoan|ho so|bai nop|email|thong tin)\b/,
  /\b(?:access|query|read|dump|show|update|delete|modify|bypass)\b.{0,80}\b(?:database|db|user table|submissions table|admin|administrator|privileges?|permissions?)\b/,
  /\b(?:truy cap|truy van|doc|xuat|cap nhat|xoa|sua|vuot qua)\b.{0,80}\b(?:co so du lieu|database|bang nguoi dung|bang bai nop|quan tri|phan quyen)\b/,
];

function getFaqs(ids: readonly AiAssistantFaqId[]): AiAssistantFaqEntry[] {
  return ids
    .map((id) => AI_ASSISTANT_FAQ.find((faq) => faq.id === id))
    .filter((faq): faq is AiAssistantFaqEntry => faq !== undefined);
}

function createFaqDecision(
  language: 'vi' | 'en',
  faqs: readonly AiAssistantFaqEntry[],
  intent: AiAssistantConversationIntent,
  continued = false,
  responseStyle: AiAssistantResponseStyle = 'user',
  technicalFocus?: AiAssistantTechnicalFocus,
): AiAssistantScopeDecision {
  const faq = faqs[0];
  if (!faq) return { scope: AiAssistantScope.UNCERTAIN, language };
  return {
    scope: AiAssistantScope.IN_SCOPE,
    language,
    responseStyle,
    ...(technicalFocus ? { technicalFocus } : {}),
    faq,
    faqs,
    conversation: {
      intent,
      faqIds: faqs.map(({ id }) => id),
      continued,
    },
  };
}

function resolveContextualFollowUp(
  normalized: string,
  language: 'vi' | 'en',
  context: AiAssistantConversationContext | undefined,
  responseStyle: AiAssistantResponseStyle,
  technicalFocus?: AiAssistantTechnicalFocus,
): AiAssistantScopeDecision | undefined {
  if (!context) return undefined;

  const canReferenceSubmissions =
    context.intent === 'problem-workflow' ||
    context.intent === 'submission-results' ||
    context.faqIds.includes('submit-problem');
  if (!canReferenceSubmissions) return undefined;

  if (FOLLOW_UP_FAILURE.test(normalized)) {
    return createFaqDecision(
      language,
      getFaqs(['submission-statuses', 'submission-history', 'submit-problem']),
      'submission-results',
      true,
      responseStyle,
      technicalFocus,
    );
  }

  if (FOLLOW_UP_WHERE.test(normalized)) {
    return createFaqDecision(
      language,
      getFaqs(['submission-history', 'submission-statuses']),
      'submission-results',
      true,
      responseStyle,
      technicalFocus,
    );
  }

  if (
    context.intent === 'submission-results' &&
    FOLLOW_UP_MEANING.test(normalized)
  ) {
    return createFaqDecision(
      language,
      getFaqs(['submission-statuses']),
      'submission-results',
      true,
      responseStyle,
      technicalFocus,
    );
  }

  return undefined;
}

function isSecurityRefusal(normalized: string): boolean {
  return (
    SECURITY_REFUSAL_REQUESTS.some((pattern) => pattern.test(normalized)) ||
    (SOLVE_PROBLEM_REQUEST.test(normalized) &&
      !WEBSITE_PROBLEM_WORKFLOW.test(normalized))
  );
}
const CLEARLY_OUT_OF_SCOPE = [
  /\b(?:explain|teach me|giai thich|huong dan)\b.{0,80}\b(?:algorithm|data structure|thuat toan|cau truc du lieu|dijkstra|dynamic programming)\b/,
  /\b(?:tarot|fortune telling|xem boi)\b/,
];
const SENSITIVE_INPUT = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:my\s+)?(?:password|passcode|mat khau)\s*(?:is|[:=])\s*\S+/i,
  /\b(?:api[_ -]?key|secret[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+/i,
  /\b(?:access[_ -]?token|refresh[_ -]?token|cookie|session cookie)\s+is\s+\S+/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\b(?:my name is|ten toi la)\s+[\p{Letter}'-]+(?:\s+[\p{Letter}'-]+){0,3}/iu,
  /\b(?:phone|mobile|sdt|so dien thoai)\s*[:=]?\s*\+?[\d ()-]{8,}/i,
  /\b(?:my address is|dia chi cua toi la)\s+.{6,80}/iu,
  /\b(?:ssn|passport number|credit card number|card number)\s*[:=]?\s*[A-Z0-9 -]{6,}/iu,
];
const INPUT_MUST_NOT_BE_FORWARDED = [
  /```/,
  /(?:^|\n)\s*(?:#include|import|from\s+\w+\s+import|def\s+\w+\s*\(|class\s+\w+|function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\b/im,
  /\b(?:select\s+[\w*,"` ]+\s+from|insert\s+into\s+\w+|update\s+\w+\s+set|delete\s+from\s+\w+)\b/i,
  /\b(?:hidden\s+test(?:\s+case)?(?:\s*#?\d+)?|user[_ -]?id|account[_ -]?id|db[_ -]?record|database row)\s*[:=]/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\bsk-or-v1-[A-Za-z0-9_-]{8,}\b/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
];
const UNSUPPORTED_SIGN_IN_FAILURE = [
  /\b(?:can t|cannot|unable to|not able to|doesn t work|isn t working|failed to|error when|problem with)\b.{0,70}\b(?:sign in|log in|login|register|sign up|password|submit|submission)\b/,
  /\b(?:sign in|log in|login|register|sign up|password|submit|submission)\b.{0,70}\b(?:doesn t work|isn t working|failed|can t|cannot|error)\b/,
  /\b(?:khong the|khong duoc|bi loi|gap loi|loi khi)\b.{0,70}\b(?:dang nhap|dang ky|mat khau|tai khoan|nop bai|bai nop)\b|\b(?:dang nhap|dang ky|mat khau|tai khoan|nop bai|bai nop)\b.{0,70}\b(?:khong the|khong duoc|bi loi|gap loi|loi)\b/,
];
const NEGATED_PLATFORM_REQUEST = [
  /\b(?:i|we)\b.{0,12}\b(?:do not|don t|never|no longer)\b.{0,20}\b(?:want|need|intend|plan)\b.{0,45}\b(?:sign in|log in|login|register|sign up|submit|submitting|submission|leaderboard|ranking|notifications|join an organization|contest)\b/,
  /\b(?:i|we)\b.{0,12}\b(?:do not|don t|never|no longer)\b.{0,20}\b(?:want|need)\b.{0,45}\b(?:help|instructions|guidance)\b.{0,30}\b(?:sign in|log in|login|register|submit|submitting|submission)\b/,
  /\b(?:toi|minh|chung toi)\b.{0,18}\bkhong (?:muon|can)\b.{0,45}\b(?:dang nhap|dang ky|nop bai|bai nop|bang xep hang|leaderboard|ranking|thong bao|notifications|tham gia to chuc|cuoc thi)\b/,
  /\bkhong phai toi\b.{0,25}\bmuon\b.{0,35}\b(?:dang nhap|dang ky|nop bai|bang xep hang|leaderboard|notifications|tham gia to chuc|cuoc thi)\b/,
];
const OUT_OF_SCOPE_REQUESTS = [
  /\b(?:give|tell|share|provide|suggest|recommend|make|write)\b.{0,30}\b(?:me )?(?:a )?recipe\b/,
  /\brecipe for\b/,
  /\bhow\b.{0,35}\b(?:cook|bake)\b/,
  /\b(?:cook|bake)\b.{0,30}\b(?:dinner|lunch|breakfast|meal|rice|soup|food)\b/,
  /\b(?:cho toi|hay cho toi|dua toi|xin cho toi)\b.{0,25}\b(?:cong thuc|recipe)\b/,
  /\b(?:huong dan|chi toi|day toi|cach)\b.{0,25}\b(?:nau an|nau com|nau mon|lam mon an)\b/,
  /\b(?:nau com|nau an|nau mon an)\b/,
  /\b(?:tell me|write|make up|share)\b.{0,20}\b(?:a )?(?:joke|story)\b/,
  /\b(?:tell me a joke|write a story|ke chuyen|cau chuyen cuoi|cau chuyen co tich)\b/,
  /\b(?:what|how|tell me|give me|forecast|will it|is it|does it|can you tell me)\b.{0,60}\b(?:weather|rain|raining|sunny|temperature|climate)\b|\b(?:weather|rain|raining|sunny|temperature|climate)\b.{0,50}\b(?:today|tomorrow|outside|like|forecast|be)\b/,
  /\b(?:hom nay|ngay mai)\b.{0,40}\b(?:troi|mua|nang|lanh|nong|bao)\b|\b(?:thoi tiet|du bao)\b.{0,50}\b(?:hom nay|ngay mai|the nao|ra sao|mua|nang|lanh|nong)\b/,
  /\b(?:tell me about|explain|what is|what s)\b.{0,35}\bpolitics\b/,
  /\b(?:noi ve|giai thich|chinh tri)\b.{0,35}\b(?:chinh tri)?\b/,
];
const NAMED_PLATFORM_OBJECT = [
  /\b(?:problem|exercise|contest|organization)\s+(?:named|called|titled)\s+.*?(?=\b(?:and|but|also|or)\b|[,;!?]|$)/g,
  /\b(?:bai tap|bai toan|cuoc thi|to chuc)\s+(?:co ten|ten la|duoc goi la)\s+.*?(?=\b(?:va|nhung|dong thoi)\b|[,;!?]|$)/g,
];

function withoutNamedPlatformObjects(normalized: string): string {
  return NAMED_PLATFORM_OBJECT.reduce((result, pattern) => {
    const matcher = new RegExp(pattern.source, pattern.flags);
    return result.replace(matcher, ' ');
  }, normalized);
}

function requestsHiddenTests(normalized: string): boolean {
  return normalized
    .split(HIDDEN_TEST_CLAUSE_SEPARATORS)
    .some(
      (clause) =>
        UNSAFE_HIDDEN_TEST_REQUEST.test(clause) &&
        !HIDDEN_TEST_VISIBILITY_QUESTION.test(clause),
    );
}

@Injectable()
export class AiAssistantScopePolicy {
  classify(
    question: string,
    conversationContext?: AiAssistantConversationContext,
  ): AiAssistantScopeDecision {
    return this.classifyQuestion(question, conversationContext, true);
  }

  private classifyQuestion(
    question: string,
    conversationContext: AiAssistantConversationContext | undefined,
    allowFuzzyMatch: boolean,
    responseStyle: AiAssistantResponseStyle = 'user',
    technicalFocus?: AiAssistantTechnicalFocus,
  ): AiAssistantScopeDecision {
    const normalized = normalizeAiAssistantQuestion(question);
    const language = detectAiAssistantLanguage(question, normalized);
    if (responseStyle === 'user') {
      technicalFocus = TECHNICAL_STATUSES.find((status) => {
        const statusMatch = new RegExp(
          `(?:^|[^A-Z0-9_])${status}(?:$|[^A-Z0-9_])`,
        ).test(question);
        const normalizedStatus = status.toLocaleLowerCase('en');
        const lowercaseStatusMatch =
          new RegExp(`\\b${normalizedStatus}\\b`, 'u').test(normalized) &&
          STATUS_MEANING_QUESTION.test(normalized);
        return statusMatch || lowercaseStatusMatch;
      });
      if (
        technicalFocus ||
        TECHNICAL_REQUEST.test(normalized) ||
        /\/[A-Za-z]/u.test(question)
      ) {
        responseStyle = 'technical';
      }
    }

    if (
      INPUT_MUST_NOT_BE_FORWARDED.some((pattern) => pattern.test(question)) ||
      isSecurityRefusal(normalized) ||
      requestsHiddenTests(normalized)
    ) {
      return {
        scope: AiAssistantScope.OUT_OF_SCOPE,
        language,
        reason: 'security_refusal',
      };
    }

    if (CLEARLY_OUT_OF_SCOPE.some((pattern) => pattern.test(normalized))) {
      return { scope: AiAssistantScope.OUT_OF_SCOPE, language };
    }

    const normalizedWithoutNamedObjects =
      withoutNamedPlatformObjects(normalized);
    if (
      OUT_OF_SCOPE_REQUESTS.some((pattern) =>
        pattern.test(normalizedWithoutNamedObjects),
      )
    ) {
      return { scope: AiAssistantScope.OUT_OF_SCOPE, language };
    }

    if (SENSITIVE_INPUT.some((pattern) => pattern.test(question))) {
      return {
        scope: AiAssistantScope.UNCERTAIN,
        language,
        reason: 'sensitive_input',
      };
    }

    if (NEGATED_PLATFORM_REQUEST.some((pattern) => pattern.test(normalized))) {
      return {
        scope: AiAssistantScope.UNCERTAIN,
        language,
        reason: 'negated_request',
      };
    }

    if (
      UNSUPPORTED_SIGN_IN_FAILURE.some((pattern) => pattern.test(normalized))
    ) {
      return {
        scope: AiAssistantScope.UNCERTAIN,
        language,
        reason: 'needs_clarification',
      };
    }

    const contextualFollowUp = resolveContextualFollowUp(
      normalized,
      language,
      conversationContext,
      responseStyle,
      technicalFocus,
    );
    if (contextualFollowUp) return contextualFollowUp;

    if (WEBSITE_PROBLEM_WORKFLOW.test(normalized)) {
      return createFaqDecision(
        language,
        getFaqs(['problem-search', 'problem-details', 'submit-problem']),
        'problem-workflow',
        false,
        responseStyle,
        technicalFocus,
      );
    }

    if (SUBMISSION_RESULTS_WORKFLOW.test(normalized)) {
      return createFaqDecision(
        language,
        getFaqs(['submission-statuses', 'submission-history']),
        'submission-results',
        false,
        responseStyle,
        technicalFocus,
      );
    }

    const faqMatch = matchFaqIntent(normalized);
    if (faqMatch.kind === 'ambiguous') {
      return {
        scope: AiAssistantScope.UNCERTAIN,
        language,
        responseStyle,
        ...(technicalFocus ? { technicalFocus } : {}),
      };
    }
    if (faqMatch.kind === 'matched') {
      return createFaqDecision(
        language,
        [faqMatch.faq],
        'faq-guidance',
        false,
        responseStyle,
        technicalFocus,
      );
    }

    const basicConversation = matchBasicConversation(normalized, language);
    if (basicConversation) {
      return {
        scope: AiAssistantScope.IN_SCOPE,
        language,
        basicIntent: basicConversation.intent,
        basicReply: basicConversation.answer,
      };
    }

    if (PROBLEM_TOPIC_ONLY.test(normalized)) {
      return {
        scope: AiAssistantScope.UNCERTAIN,
        language,
        clarification: 'problem-topic',
        responseStyle,
        ...(technicalFocus ? { technicalFocus } : {}),
      };
    }

    if (allowFuzzyMatch) {
      const fuzzyQuestion = normalizeAiAssistantFuzzyQuestion(question);
      if (fuzzyQuestion) {
        return this.classifyQuestion(
          fuzzyQuestion,
          conversationContext,
          false,
          responseStyle,
          technicalFocus,
        );
      }
    }

    return {
      scope: AiAssistantScope.UNCERTAIN,
      language,
      responseStyle,
      ...(technicalFocus ? { technicalFocus } : {}),
    };
  }
}
