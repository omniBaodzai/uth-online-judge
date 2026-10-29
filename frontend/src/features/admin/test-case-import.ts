export type ImportedTestCase = {
  stem: string
  input: string
  expectedOutput: string
}

export type TestCaseImportError = {
  fileName: string
  message: string
}

export type TestCaseImportResult = {
  cases: ImportedTestCase[]
  errors: TestCaseImportError[]
}

export type TestCaseImportLimits = {
  maxFiles: number
  maxFileBytes: number
  maxTotalBytes: number
}

export const DEFAULT_TEST_CASE_IMPORT_LIMITS: TestCaseImportLimits = {
  maxFiles: 1000,
  maxFileBytes: 100_000,
  maxTotalBytes: 50_000_000,
}

type FileEntry = {
  file: File
  stem: string
  extension: 'in' | 'out'
}

export async function parseTestCaseFiles(
  files: readonly File[],
  limits: TestCaseImportLimits = DEFAULT_TEST_CASE_IMPORT_LIMITS,
): Promise<TestCaseImportResult> {
  const errors: TestCaseImportError[] = []
  if (files.length === 0) return { cases: [], errors: [] }
  if (files.length > limits.maxFiles) {
    return {
      cases: [],
      errors: [{ fileName: '', message: `Chỉ được chọn tối đa ${limits.maxFiles} tệp mỗi lần.` }],
    }
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  if (totalBytes > limits.maxTotalBytes) {
    return {
      cases: [],
      errors: [{ fileName: '', message: `Tổng dung lượng vượt quá ${formatBytes(limits.maxTotalBytes)}.` }],
    }
  }

  const entries: FileEntry[] = []
  const seen = new Set<string>()
  for (const file of files) {
    const fileName = basename(file.name)
    const match = /^(.*)\.(in|out)$/i.exec(fileName)
    if (!match || !match[1]) {
      errors.push({ fileName, message: 'Chỉ chấp nhận tệp có phần mở rộng .in hoặc .out.' })
      continue
    }
    if (file.size > limits.maxFileBytes) {
      errors.push({ fileName, message: `Dung lượng tệp vượt quá ${formatBytes(limits.maxFileBytes)}.` })
      continue
    }
    const stem = match[1]
    const extension = match[2]!.toLowerCase() as FileEntry['extension']
    const duplicateKey = `${stem.toLocaleLowerCase()}\u0000${extension}`
    if (seen.has(duplicateKey)) {
      errors.push({ fileName, message: 'Tên tệp bị trùng hoặc xung đột với một tệp đã chọn.' })
      continue
    }
    seen.add(duplicateKey)
    entries.push({ file, stem, extension })
  }

  const byStem = new Map<string, { input?: File; output?: File; stem: string }>()
  for (const entry of entries) {
    const pair = byStem.get(entry.stem) ?? { stem: entry.stem }
    if (entry.extension === 'in') pair.input = entry.file
    else pair.output = entry.file
    byStem.set(entry.stem, pair)
  }

  const pairs = [...byStem.values()].sort((left, right) => naturalCompare(left.stem, right.stem))
  for (const pair of pairs) {
    if (!pair.input) errors.push({ fileName: `${pair.stem}.in`, message: 'Thiếu tệp input tương ứng.' })
    if (!pair.output) errors.push({ fileName: `${pair.stem}.out`, message: 'Thiếu tệp output tương ứng.' })
  }

  const completed: ImportedTestCase[] = []
  for (let start = 0; start < pairs.length; start += 20) {
    const batch = pairs.slice(start, start + 20)
    const decoded = await Promise.all(batch.map(async (pair) => {
      if (!pair.input || !pair.output) return null
      try {
        const [input, expectedOutput] = await Promise.all([
          readUtf8(pair.input),
          readUtf8(pair.output),
        ])
        if (input.length === 0 || expectedOutput.length === 0) {
          errors.push({
            fileName: input.length === 0 ? pair.input.name : pair.output.name,
            message: 'Tệp input và output không được để trống.',
          })
          return null
        }
        return { stem: pair.stem, input, expectedOutput }
      } catch {
        errors.push({
          fileName: `${pair.stem}`,
          message: 'Không thể đọc tệp dưới dạng UTF-8 hợp lệ.',
        })
        return null
      }
    }))
    completed.push(...decoded.filter(isDefined))
  }

  errors.sort((left, right) => (
    naturalCompare(left.fileName, right.fileName) || left.message.localeCompare(right.message, 'en')
  ))
  return { cases: completed, errors }
}

export function applyImportedTestCases(
  current: AdminTestCaseDraft[],
  imported: ImportedTestCase[],
  mode: 'append' | 'replace',
  createId: () => string = () => crypto.randomUUID(),
): AdminTestCaseDraft[] {
  const additions = imported.map((testCase) => ({
    clientId: createId(),
    name: testCase.stem,
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    kind: 'hidden' as const,
  }))
  return mode === 'append' ? [...current, ...additions] : additions
}

function basename(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path
}

function naturalCompare(left: string, right: string): number {
  const leftParts = left.match(/\d+|\D+/g) ?? [left]
  const rightParts = right.match(/\d+|\D+/g) ?? [right]
  const length = Math.min(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index]!
    const rightPart = rightParts[index]!
    const leftNumeric = /^\d+$/.test(leftPart)
    const rightNumeric = /^\d+$/.test(rightPart)
    if (leftNumeric && rightNumeric) {
      const difference = BigInt(leftPart) - BigInt(rightPart)
      if (difference < 0n) return -1
      if (difference > 0n) return 1
      if (leftPart.length !== rightPart.length) return leftPart.length - rightPart.length
    } else {
      const difference = leftPart.localeCompare(rightPart, 'en', { sensitivity: 'base' })
      if (difference !== 0) return difference
    }
  }
  return leftParts.length - rightParts.length || left.localeCompare(right, 'en')
}

function readUtf8(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => (
    new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer)
  ))
}

function formatBytes(value: number): string {
  return value >= 1_000_000 ? `${value / 1_000_000} MB` : `${value / 1000} KB`
}

function isDefined<T>(value: T | null): value is T {
  return value !== null
}
import type { AdminTestCaseDraft } from './types'
