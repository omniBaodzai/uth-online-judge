// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { uploadNewsImage } from './news-media-upload'

const response = {
  id: 'c4a4b748-a323-4d3a-8f76-3d72d1cb9812',
  url: '/news/media/c4a4b748-a323-4d3a-8f76-3d72d1cb9812',
  contentType: 'image/png',
  byteSize: 24,
  width: 20,
  height: 12,
}

describe('news media upload client', () => {
  it('sends an image as multipart form data and validates the server response', async () => {
    let path = ''
    let init: RequestInit | undefined
    const request = async <T,>(nextPath: string, nextInit?: RequestInit): Promise<T> => {
      path = nextPath
      init = nextInit
      return response as T
    }

    await expect(uploadNewsImage(new File(['png'], 'news.png', { type: 'image/png' }), request)).resolves.toEqual(response)
    expect(path).toBe('/admin/news/media')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(FormData)
    if (!(init?.body instanceof FormData)) throw new Error('Expected multipart form data')
    expect(init.body.get('image')).toBeInstanceOf(File)
  })

  it('rejects unsupported image types and invalid upload metadata', async () => {
    const request = async <T,>(): Promise<T> => ({ ...response, url: 'https://evil.test/image' }) as T

    await expect(uploadNewsImage(new File(['x'], 'image.svg', { type: 'image/svg+xml' }), request))
      .rejects.toThrow('Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.')
    await expect(uploadNewsImage(new File(['png'], 'news.png', { type: 'image/png' }), request))
      .rejects.toThrow('Máy chủ trả về thông tin ảnh không hợp lệ.')
  })
})
