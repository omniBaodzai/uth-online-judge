import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from '../auth/api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('shared API rate-limit metadata', () => {
  it('preserves rate-limit code and retry delay from the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 429,
            code: 'RATE_LIMIT_MINUTE',
            message: 'safe server message',
            retryAfterSeconds: 23,
          }),
          {
            status: 429,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    )

    await expect(request('/ai-assistant/chat')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMIT_MINUTE',
      retryAfterSeconds: 23,
    })
  })

  it('reads Retry-After when the response body omits its retry delay', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 429,
            code: 'CONCURRENT_REQUEST',
            message: 'safe server message',
          }),
          {
            status: 429,
            headers: {
              'content-type': 'application/json',
              'retry-after': '7',
            },
          },
        ),
      ),
    )

    await expect(request('/ai-assistant/chat')).rejects.toMatchObject({
      status: 429,
      code: 'CONCURRENT_REQUEST',
      retryAfterSeconds: 7,
    })
  })

  it('keeps rate-limit metadata typed on ApiError', () => {
    const error = new ApiError('safe message', 429, undefined, 5, 'PROVIDER_CONCURRENCY')

    expect(error).toMatchObject({
      status: 429,
      retryAfterSeconds: 5,
      code: 'PROVIDER_CONCURRENCY',
    })
  })
})
