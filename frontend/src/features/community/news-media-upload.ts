const NEWS_MEDIA_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MEDIA_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type NewsMediaUpload = {
  id: string
  url: string
  width: number
  height: number
}

function isNewsMediaUpload(value: unknown): value is NewsMediaUpload {
  if (typeof value !== 'object' || value === null) return false
  const upload = value as Record<string, unknown>
  return (
    typeof upload.id === 'string' &&
    MEDIA_ID_PATTERN.test(upload.id) &&
    upload.url === `/news/media/${upload.id}` &&
    Number.isInteger(upload.width) &&
    Number.isInteger(upload.height) &&
    Number(upload.width) > 0 &&
    Number(upload.height) > 0
  )
}

export async function uploadNewsImage(
  file: File,
  request: <T>(path: string, init?: RequestInit) => Promise<T>,
): Promise<NewsMediaUpload> {
  if (file.size === 0 || file.size > NEWS_MEDIA_MAX_BYTES) {
    throw new Error('Ảnh phải có dung lượng từ 1 byte đến 5 MiB.')
  }
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.')
  }

  const formData = new FormData()
  formData.append('image', file, file.name)
  const value = await request<unknown>('/admin/news/media', {
    method: 'POST',
    body: formData,
  })
  if (!isNewsMediaUpload(value)) {
    throw new Error('Máy chủ trả về thông tin ảnh không hợp lệ. Hãy tải lại ảnh.')
  }
  return value
}

export { NEWS_MEDIA_MAX_BYTES }
