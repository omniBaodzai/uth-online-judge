export const AI_ASSISTANT_SCOPES = [
  'IN_SCOPE',
  'OUT_OF_SCOPE',
  'UNCERTAIN',
] as const

export type AiAssistantScope = (typeof AI_ASSISTANT_SCOPES)[number]

export type AiAssistantChatResponse = {
  scope: AiAssistantScope
  answer: string
  conversationContext?: string
}

export function isAiAssistantChatResponse(
  value: unknown,
): value is AiAssistantChatResponse {
  if (typeof value !== 'object' || value === null) return false
  const response = value as Record<string, unknown>
  const context = response.conversationContext
  return (
    AI_ASSISTANT_SCOPES.some((scope) => scope === response.scope) &&
    typeof response.answer === 'string' &&
    response.answer.trim().length > 0 &&
    (context === undefined ||
      (typeof context === 'string' && context.length <= 2_048))
  )
}
