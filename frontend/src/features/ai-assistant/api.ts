import {
  isAiAssistantChatResponse,
  type AiAssistantChatResponse,
} from './types'

type AiAssistantRequest = <T>(
  path: string,
  init?: RequestInit,
) => Promise<T>

export class InvalidAiAssistantResponseError extends Error {
  constructor() {
    super('The AI assistant returned an invalid response.')
    this.name = 'InvalidAiAssistantResponseError'
  }
}

export async function sendAiAssistantMessage(
  request: AiAssistantRequest,
  message: string,
  signal?: AbortSignal,
  conversationContext?: string | null,
): Promise<AiAssistantChatResponse> {
  const response = await request<unknown>('/ai-assistant/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      ...(conversationContext ? { conversationContext } : {}),
    }),
    signal,
  })

  if (!isAiAssistantChatResponse(response)) {
    throw new InvalidAiAssistantResponseError()
  }

  return response
}
