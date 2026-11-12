import type { NewsDraft } from './validation'
import type { NewsInput, NewsPatchInput } from './api'
import type { NewsRichDocument } from './news-rich-content'

function metadata(draft: NewsDraft) {
  const slug = draft.slug.trim()
  return {
    title: draft.title.trim(),
    ...(slug ? { slug } : {}),
    category: draft.category.trim(),
    summary: draft.summary.trim(),
  }
}

export function buildNewsCreatePayload(
  draft: NewsDraft,
  mode: 'markdown' | 'rich',
  richDocument: NewsRichDocument,
): NewsInput {
  const fields = metadata(draft)
  return mode === 'rich'
    ? { ...fields, contentFormat: 'tiptap-json', contentJson: richDocument }
    : { ...fields, content: draft.content.trim() }
}

export function buildNewsPatchPayload(
  draft: NewsDraft,
  mode: 'markdown' | 'rich',
  richDocument: NewsRichDocument,
  richContentChanged: boolean,
): NewsPatchInput {
  const fields = metadata(draft)
  if (mode === 'markdown') return { ...fields, content: draft.content.trim() }
  return richContentChanged
    ? { ...fields, contentFormat: 'tiptap-json', contentJson: richDocument }
    : fields
}
