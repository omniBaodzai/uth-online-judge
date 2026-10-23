// Trình phân tích Markdown tối giản và an toàn: không bao giờ sinh HTML thô.
// Kết quả là cây dữ liệu để React render; mọi chuỗi đều được React tự escape.
export type Inline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }

export type Block =
  | { type: 'heading'; level: 2 | 3 | 4; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'code'; value: string }

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function sanitizeHref(href: string): string | null {
  const value = href.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    return SAFE_PROTOCOLS.has(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

const INLINE_PATTERN = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/

export function parseInline(source: string, allowLinks = true): Inline[] {
  const nodes: Inline[] = []
  let rest = source
  while (rest) {
    const match = INLINE_PATTERN.exec(rest)
    if (!match) {
      nodes.push({ type: 'text', value: rest })
      break
    }
    if (match.index > 0) nodes.push({ type: 'text', value: rest.slice(0, match.index) })
    const [whole, code, strong, em, linkText, linkHref] = match
    if (code !== undefined) {
      nodes.push({ type: 'code', value: code })
    } else if (strong !== undefined) {
      nodes.push({ type: 'strong', children: parseInline(strong, allowLinks) })
    } else if (em !== undefined) {
      nodes.push({ type: 'em', children: parseInline(em, allowLinks) })
    } else {
      const href = allowLinks ? sanitizeHref(linkHref) : null
      // Liên kết không an toàn (javascript:, data:, ...) chỉ hiện phần chữ.
      if (href) nodes.push({ type: 'link', href, children: parseInline(linkText, false) })
      else nodes.push({ type: 'text', value: linkText })
    }
    rest = rest.slice(match.index + whole.length)
  }
  return nodes
}

const HEADING = /^(#{1,4})\s+(.+)$/
const BULLET = /^\s*[-*+]\s+(.+)$/
const ORDERED = /^\s*\d+[.)]\s+(.+)$/
const QUOTE = /^>\s?(.*)$/

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.trimStart().startsWith('```')) {
      const body: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trimStart().startsWith('```')) {
        body.push(lines[index])
        index += 1
      }
      index += 1
      blocks.push({ type: 'code', value: body.join('\n') })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      // h1 dành cho tiêu đề bài viết nên nội dung bắt đầu từ h2.
      const level = Math.min(Math.max(heading[1].length + 1, 2), 4) as 2 | 3 | 4
      blocks.push({ type: 'heading', level, children: parseInline(heading[2].trim()) })
      index += 1
      continue
    }

    const listPattern = BULLET.test(line) ? BULLET : ORDERED.test(line) ? ORDERED : null
    if (listPattern) {
      const items: Inline[][] = []
      while (index < lines.length) {
        const item = listPattern.exec(lines[index])
        if (!item) break
        items.push(parseInline(item[1].trim()))
        index += 1
      }
      blocks.push({ type: 'list', ordered: listPattern === ORDERED, items })
      continue
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = []
      while (index < lines.length) {
        const item = QUOTE.exec(lines[index])
        if (!item) break
        quoted.push(item[1])
        index += 1
      }
      blocks.push({ type: 'quote', children: parseInline(quoted.join(' ').trim()) })
      continue
    }

    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trimStart().startsWith('```') &&
      !HEADING.test(lines[index]) &&
      !BULLET.test(lines[index]) &&
      !ORDERED.test(lines[index]) &&
      !QUOTE.test(lines[index])
    ) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) })
  }

  return blocks
}
