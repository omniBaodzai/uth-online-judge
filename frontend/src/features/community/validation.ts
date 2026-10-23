const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type NewsDraft = { title: string; slug: string; category: string; summary: string; content: string }
export type NewsErrors = Partial<Record<keyof NewsDraft, string>>

// Phản chiếu quy tắc của backend (NewsInputDto) để báo lỗi tiếng Việt ngay tại ô nhập.
export function validateNews(draft: NewsDraft): NewsErrors {
  const errors: NewsErrors = {}
  const title = draft.title.trim()
  if (title.length < 3 || title.length > 200) errors.title = 'Tiêu đề phải từ 3 đến 200 ký tự.'
  const slug = draft.slug.trim()
  if (slug && (slug.length > 120 || !SLUG_PATTERN.test(slug))) {
    errors.slug = 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang (ví dụ: chao-mung-ban).'
  }
  const category = draft.category.trim()
  if (!category || category.length > 50) errors.category = 'Danh mục phải từ 1 đến 50 ký tự.'
  const summary = draft.summary.trim()
  if (!summary || summary.length > 500) errors.summary = 'Tóm tắt phải từ 1 đến 500 ký tự.'
  const content = draft.content.trim()
  if (!content || content.length > 50000) errors.content = 'Nội dung phải từ 1 đến 50.000 ký tự.'
  return errors
}
