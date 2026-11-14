import { Injectable } from '@nestjs/common';
import type {
  AiAssistantFaqId,
  AiAssistantFaqEntry,
  AiAssistantGeneratedClaim,
  AiAssistantGlossaryEntry,
  AiAssistantLanguage,
  AiAssistantResponseStyle,
  AiAssistantTechnicalFocus,
} from './ai-assistant.types.js';
import type { OpenRouterCompletion } from './openrouter.client.js';

export type AiAssistantOutputRejectionReason =
  | 'invalid_provider_json'
  | 'invalid_provider_envelope'
  | 'incomplete_response'
  | 'unexpected_finish_reason'
  | 'empty_response'
  | 'invalid_json'
  | 'root_not_object'
  | 'missing_required_field'
  | 'unknown_field'
  | 'invalid_field_type'
  | 'invalid_language'
  | 'empty_claims'
  | 'too_many_claims'
  | 'invalid_claim_shape'
  | 'missing_source_id'
  | 'missing_claim_text'
  | 'invalid_claim_type'
  | 'invalid_faq_selection'
  | 'invalid_glossary_selection'
  | 'language_mismatch'
  | 'invalid_source_id'
  | 'duplicate_source_id'
  | 'response_too_long'
  | 'code_content'
  | 'secret_content'
  | 'out_of_scope_content'
  | 'unsupported_route'
  | 'unsupported_claim';

export type AiAssistantOutputRejectionStage =
  | 'provider_envelope'
  | 'completion'
  | 'parsing'
  | 'schema_validation'
  | 'output_policy';

export type AiAssistantGeneratedResponseDecision =
  | {
      accepted: true;
      answer: string;
      faqIds: AiAssistantFaqId[];
      glossaryIds: string[];
    }
  | {
      accepted: false;
      stage: AiAssistantOutputRejectionStage;
      reason: AiAssistantOutputRejectionReason;
    };

const MAX_ANSWER_LENGTH = 4_000;
const MAX_CLAIMS = 5;
const MAX_FAQ_SELECTION = 3;
const MAX_GLOSSARY_SELECTION = 3;
const MINIMUM_GROUNDING_RATIO = 0.5;

const CODE_CONTENT =
  /```|<\/?(?:code|pre)\b|\b(?:#include\s*<|int\s+main\s*\(|def\s+\w+\s*\(|function\s+\w+\s*\()/i;
const SECRET_OR_ROLE_CONTENT =
  /\b(?:sk-or-v1-[a-z0-9]{8,}|api[_ -]?key|system prompt|system instructions|credentials|secret key|ignore (?:all )?(?:previous|prior) instructions|developer mode|you are now (?:an? )?(?:admin|developer)|pretend to be an? (?:admin|developer))\b/i;
const CLEARLY_OUT_OF_SCOPE_CONTENT =
  /\b(?:algorithm implementation|dijkstra algorithm|dynamic programming solution|the weather today|i can help you solve|here is the (?:code|solution))\b/i;
const HIDDEN_TEST_DISCLOSURE =
  /\b(?:here (?:are|is)|provide|give|reveal|show|download|access)\b.{0,60}\bhidden tests?\b|\bhidden tests?\b.{0,60}\b(?:available|provided|revealed|downloaded)\b/i;
const SENSITIVE_OUTPUT =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b|\bBearer\s+[A-Za-z0-9._~+/-]+=*|\b(?:password|access token|refresh token)\s*(?:is|[:=])\s*\S+/i;
const ROUTE_OR_URL =
  /https?:\/\/[^\s<>"`]+|(?<![\p{Letter}\p{Number}])\/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@%/-]*/giu;
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/u;
const STOP_WORDS: Record<AiAssistantLanguage, ReadonlySet<string>> = {
  en: new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'can',
    'do',
    'for',
    'from',
    'has',
    'have',
    'if',
    'in',
    'is',
    'it',
    'may',
    'of',
    'on',
    'or',
    'the',
    'then',
    'to',
    'you',
    'your',
  ]),
  vi: new Set([
    'bạn',
    'bằng',
    'bị',
    'các',
    'cho',
    'có',
    'của',
    'đã',
    'đang',
    'để',
    'được',
    'hay',
    'khi',
    'là',
    'nếu',
    'những',
    'ở',
    'sau',
    'theo',
    'thì',
    'trong',
    'và',
    'với',
  ]),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getContentTokens(
  value: string,
  language: AiAssistantLanguage,
): string[] {
  return (
    value
      .normalize('NFKC')
      .toLocaleLowerCase(language)
      .match(/[\p{Letter}\p{Number}]+/gu) ?? []
  ).filter((token) => token.length > 1 && !STOP_WORDS[language].has(token));
}

function hasGroundedWording(
  claim: AiAssistantGeneratedClaim,
  evidence: readonly string[],
  language: AiAssistantLanguage,
): boolean {
  const text = claim.text.trim();
  if (
    !text ||
    text.includes('\n') ||
    text.split(SENTENCE_BOUNDARY).length !== 1
  ) {
    return false;
  }

  const claimTokens = getContentTokens(text, language);
  if (claimTokens.length === 0) return false;
  const evidenceTokens = new Set(
    evidence.flatMap((phrase) => getContentTokens(phrase, language)),
  );
  const supportedTokenCount = claimTokens.filter((token) =>
    evidenceTokens.has(token),
  ).length;
  return supportedTokenCount / claimTokens.length >= MINIMUM_GROUNDING_RATIO;
}

function routeTemplateMatches(route: string, template: string): boolean {
  const escapedTemplate = template.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const withParameters = escapedTemplate.replace(
    /:[A-Za-z][A-Za-z0-9_]*/gu,
    '[^/?#]+',
  );
  return new RegExp(`^${withParameters}/?$`, 'iu').test(route);
}

function hasOnlyApprovedRoutes(
  content: string,
  allowedRoutes: readonly string[],
): boolean {
  const routes = content.match(ROUTE_OR_URL) ?? [];
  return routes.every((route) => {
    if (/^https?:\/\//iu.test(route)) return false;
    const normalizedRoute = route.replace(/[.,!?;:)]+$/u, '');
    return allowedRoutes.some((template) =>
      routeTemplateMatches(normalizedRoute, template),
    );
  });
}

function hasSafeContent(
  content: string,
): AiAssistantOutputRejectionReason | undefined {
  if (CODE_CONTENT.test(content)) return 'code_content';
  if (SECRET_OR_ROLE_CONTENT.test(content) || SENSITIVE_OUTPUT.test(content)) {
    return 'secret_content';
  }
  if (CLEARLY_OUT_OF_SCOPE_CONTENT.test(content)) {
    return 'out_of_scope_content';
  }
  if (HIDDEN_TEST_DISCLOSURE.test(content)) {
    return 'out_of_scope_content';
  }
  return undefined;
}

@Injectable()
export class AiAssistantOutputPolicy {
  validateGeneratedResponse(
    completion: OpenRouterCompletion,
    candidates: readonly AiAssistantFaqEntry[],
    glossaryCandidates: readonly AiAssistantGlossaryEntry[],
    language: AiAssistantLanguage,
    responseStyle: AiAssistantResponseStyle,
    technicalFocus?: AiAssistantTechnicalFocus,
  ): AiAssistantGeneratedResponseDecision {
    if (completion.responseIssue) {
      return {
        accepted: false,
        stage: 'provider_envelope',
        reason: completion.responseIssue,
      };
    }

    if (completion.finishReason === 'length') {
      return {
        accepted: false,
        stage: 'completion',
        reason: 'incomplete_response',
      };
    }
    if (
      completion.finishReason !== undefined &&
      completion.finishReason !== null &&
      completion.finishReason !== 'stop'
    ) {
      return {
        accepted: false,
        stage: 'completion',
        reason: 'unexpected_finish_reason',
      };
    }
    if (
      completion.content === null ||
      completion.content === undefined ||
      (typeof completion.content === 'string' &&
        completion.content.trim() === '')
    ) {
      return {
        accepted: false,
        stage: 'completion',
        reason: 'empty_response',
      };
    }
    if (
      completion.finishReason === undefined ||
      completion.finishReason === null
    ) {
      return {
        accepted: false,
        stage: 'completion',
        reason: 'incomplete_response',
      };
    }
    if (typeof completion.content !== 'string') {
      return {
        accepted: false,
        stage: 'schema_validation',
        reason: 'invalid_field_type',
      };
    }
    if (completion.content.length > MAX_ANSWER_LENGTH * 3) {
      return {
        accepted: false,
        stage: 'schema_validation',
        reason: 'response_too_long',
      };
    }

    let value: unknown;
    try {
      value = JSON.parse(completion.content);
    } catch {
      return { accepted: false, stage: 'parsing', reason: 'invalid_json' };
    }
    if (!isRecord(value)) {
      return {
        accepted: false,
        stage: 'schema_validation',
        reason: 'root_not_object',
      };
    }

    const expectedKeys = ['faqIds', 'glossaryIds', 'language', 'claims'];
    const missingKeys = expectedKeys.filter(
      (key) => !Object.hasOwn(value, key),
    );
    const unknownKeys = Object.keys(value).filter(
      (key) => !expectedKeys.includes(key),
    );
    if (missingKeys.length > 0) {
      return {
        accepted: false,
        stage: 'schema_validation',
        reason: 'missing_required_field',
      };
    }
    if (unknownKeys.length > 0) {
      return {
        accepted: false,
        stage: 'schema_validation',
        reason: 'unknown_field',
      };
    }
    if (
      !Array.isArray(value.faqIds) ||
      !value.faqIds.every((id) => typeof id === 'string') ||
      !Array.isArray(value.glossaryIds) ||
      !value.glossaryIds.every((id) => typeof id === 'string') ||
      !Array.isArray(value.claims) ||
      typeof value.language !== 'string'
    ) {
      return {
        accepted: false,
        stage: 'schema_validation',
        reason: 'invalid_field_type',
      };
    }
    if (value.language !== 'vi' && value.language !== 'en') {
      return {
        accepted: false,
        stage: 'schema_validation',
        reason: 'invalid_language',
      };
    }
    if (value.language !== language) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: 'language_mismatch',
      };
    }

    const faqIds = value.faqIds as string[];
    const glossaryIds = value.glossaryIds as string[];
    if (
      faqIds.length === 0 ||
      faqIds.length > MAX_FAQ_SELECTION ||
      new Set(faqIds).size !== faqIds.length
    ) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: 'invalid_faq_selection',
      };
    }
    if (faqIds.some((id) => !candidates.some((faq) => faq.id === id))) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: 'invalid_faq_selection',
      };
    }
    if (
      glossaryIds.length > MAX_GLOSSARY_SELECTION ||
      new Set(glossaryIds).size !== glossaryIds.length
    ) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: 'invalid_glossary_selection',
      };
    }
    if (
      glossaryIds.some(
        (id) => !glossaryCandidates.some((entry) => entry.id === id),
      )
    ) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: 'invalid_glossary_selection',
      };
    }
    if (value.claims.length === 0) {
      return {
        accepted: false,
        stage: 'schema_validation',
        reason: 'empty_claims',
      };
    }
    if (value.claims.length > MAX_CLAIMS) {
      return {
        accepted: false,
        stage: 'schema_validation',
        reason: 'too_many_claims',
      };
    }
    for (const claim of value.claims) {
      if (!isRecord(claim)) {
        return {
          accepted: false,
          stage: 'schema_validation',
          reason: 'invalid_claim_shape',
        };
      }
      const claimKeys = Object.keys(claim);
      if (claimKeys.some((key) => key !== 'sourceId' && key !== 'text')) {
        return {
          accepted: false,
          stage: 'schema_validation',
          reason: 'unknown_field',
        };
      }
      if (!Object.hasOwn(claim, 'sourceId')) {
        return {
          accepted: false,
          stage: 'schema_validation',
          reason: 'missing_source_id',
        };
      }
      if (!Object.hasOwn(claim, 'text')) {
        return {
          accepted: false,
          stage: 'schema_validation',
          reason: 'missing_claim_text',
        };
      }
      if (
        claimKeys.length !== 2 ||
        typeof claim.sourceId !== 'string' ||
        typeof claim.text !== 'string'
      ) {
        return {
          accepted: false,
          stage: 'schema_validation',
          reason: 'invalid_claim_type',
        };
      }
    }

    const selectedFaqs = faqIds
      .map((id) => candidates.find((faq) => faq.id === id))
      .filter((faq): faq is AiAssistantFaqEntry => faq !== undefined);
    const selectedGlossary = glossaryIds
      .map((id) => glossaryCandidates.find((entry) => entry.id === id))
      .filter(
        (entry): entry is AiAssistantGlossaryEntry => entry !== undefined,
      );
    if (selectedGlossary.some((entry) => !faqIds.includes(entry.faqId))) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: 'invalid_glossary_selection',
      };
    }

    const claims = value.claims as AiAssistantGeneratedClaim[];
    const usedSourceIds = new Set<string>();
    for (const claim of claims) {
      const claimSafetyRejection = hasSafeContent(claim.text);
      if (claimSafetyRejection) {
        return {
          accepted: false,
          stage: 'output_policy',
          reason: claimSafetyRejection,
        };
      }
      if (usedSourceIds.has(claim.sourceId)) {
        return {
          accepted: false,
          stage: 'output_policy',
          reason: 'duplicate_source_id',
        };
      }
      usedSourceIds.add(claim.sourceId);

      const glossaryId = claim.sourceId.startsWith('glossary:')
        ? claim.sourceId.slice('glossary:'.length)
        : undefined;
      const glossaryEntry = glossaryId
        ? selectedGlossary.find((entry) => entry.id === glossaryId)
        : undefined;
      if (claim.sourceId.startsWith('glossary:') && !glossaryEntry) {
        return {
          accepted: false,
          stage: 'output_policy',
          reason: 'invalid_source_id',
        };
      }
      const sourceParts = claim.sourceId.startsWith('glossary:')
        ? undefined
        : claim.sourceId.split('#');
      if (
        sourceParts &&
        (sourceParts.length !== 2 ||
          !sourceParts[0] ||
          !sourceParts[1] ||
          !selectedFaqs.some((faq) => faq.id === sourceParts[0]))
      ) {
        return {
          accepted: false,
          stage: 'output_policy',
          reason: 'invalid_source_id',
        };
      }
      const sourceFaq = sourceParts
        ? selectedFaqs.find((faq) => faq.id === sourceParts[0])
        : undefined;
      const sourceStatement = sourceFaq?.approvedStatements.find(
        (statement) => statement.id === sourceParts?.[1],
      );
      if (sourceParts && !sourceStatement) {
        return {
          accepted: false,
          stage: 'output_policy',
          reason: 'invalid_source_id',
        };
      }

      let evidence: readonly string[] = [];
      if (glossaryEntry) {
        const glossaryFaq = selectedFaqs.find(
          (faq) => faq.id === glossaryEntry.faqId,
        );
        const glossaryStatement = glossaryFaq?.approvedStatements.find(
          (statement) => statement.id === glossaryEntry.statementId,
        );
        if (!glossaryStatement) {
          return {
            accepted: false,
            stage: 'output_policy',
            reason: 'unsupported_claim',
          };
        }
        evidence = [
          glossaryEntry.phrases[language],
          ...glossaryStatement.phrases[language],
        ];
      } else if (sourceStatement && sourceFaq) {
        if (
          technicalFocus &&
          sourceStatement.id !== `status-${technicalFocus.toLowerCase()}`
        ) {
          return {
            accepted: false,
            stage: 'output_policy',
            reason: 'unsupported_claim',
          };
        }
        evidence =
          responseStyle === 'technical'
            ? (sourceStatement.technicalPhrases?.[language] ??
              sourceStatement.phrases[language])
            : sourceStatement.phrases[language];
      }
      if (
        evidence.length === 0 ||
        !hasGroundedWording(claim, evidence, language)
      ) {
        return {
          accepted: false,
          stage: 'output_policy',
          reason: 'unsupported_claim',
        };
      }
    }

    const answer = claims.map(({ text }) => text.trim()).join(' ');
    if (!answer.trim()) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: 'empty_response',
      };
    }
    if (answer.length > MAX_ANSWER_LENGTH) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: 'response_too_long',
      };
    }
    const safetyRejection = hasSafeContent(answer);
    if (safetyRejection) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: safetyRejection,
      };
    }
    if (
      !hasOnlyApprovedRoutes(
        answer,
        selectedFaqs.flatMap((faq) => faq.allowedRoutes),
      )
    ) {
      return {
        accepted: false,
        stage: 'output_policy',
        reason: 'unsupported_route',
      };
    }

    return {
      accepted: true,
      answer,
      faqIds: faqIds as AiAssistantFaqId[],
      glossaryIds,
    };
  }
}
