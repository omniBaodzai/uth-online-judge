import { describe, expect, it, vi } from 'vitest'
import { LANGUAGE_STORAGE_KEY, parseLanguage, readLanguage, storeLanguage } from './language'
import { resources } from './locales'

function translationPaths(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child && typeof child === 'object' && !Array.isArray(child)
      ? translationPaths(child as Record<string, unknown>, path)
      : [path]
  })
}

describe('language preferences', () => {
  it('keeps Vietnamese and English keys in sync for every namespace', () => {
    for (const namespace of Object.keys(resources.vi) as Array<keyof typeof resources.vi>) {
      expect(translationPaths(resources.en[namespace]).sort(), namespace)
        .toEqual(translationPaths(resources.vi[namespace]).sort())
    }
  })

  it('keeps password recovery translations in the auth namespace', () => {
    expect(resources.vi.auth.forgotTitle).toBeTruthy()
    expect(resources.en.auth.forgotTitle).toBeTruthy()
    expect('forgotTitle' in resources.vi.pages).toBe(false)
    expect('forgotTitle' in resources.en.pages).toBe(false)
  })

  it('translates every password strength level and label in English', () => {
    const { auth } = resources.en
    const levels = [0, 1, 2, 3, 4].map((n) => auth[`strengthLevel${n}` as keyof typeof auth])
    expect(levels).toEqual(['Very weak', 'Weak', 'Medium', 'Strong', 'Very strong'])
    expect(auth.strengthTitle).toBe('Password strength')
    expect(auth.strengthMinLength).toBe('8+ characters')
  })

  it('keeps runtime feature translation bundles in sync', async () => {
    try {
      vi.stubGlobal('window', {
        localStorage: {
          getItem: () => null,
          setItem: () => undefined,
        },
      })
      vi.stubGlobal('document', { documentElement: { lang: 'vi' } })
      await import('../features/problems/i18n')
      await import('../features/submissions/i18n')
      const { default: i18n } = await import('./index')

      for (const namespace of Object.keys(resources.vi) as Array<keyof typeof resources.vi>) {
        expect(
          translationPaths(i18n.getResourceBundle('en', namespace) ?? {}).sort(),
          namespace,
        ).toEqual(translationPaths(i18n.getResourceBundle('vi', namespace) ?? {}).sort())
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('defaults to Vietnamese for missing or unsupported values', () => {
    expect(parseLanguage(null)).toBe('vi')
    expect(parseLanguage('fr')).toBe('vi')
  })

  it('accepts Vietnamese and English', () => {
    expect(parseLanguage('vi')).toBe('vi')
    expect(parseLanguage('en')).toBe('en')
  })

  it('reads and persists the selected language', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(storeLanguage(storage, 'en')).toBe(true)
    expect(values.get(LANGUAGE_STORAGE_KEY)).toBe('en')
    expect(readLanguage(storage)).toBe('en')
  })

  it('falls back to Vietnamese when storage is unavailable', () => {
    const storage = {
      getItem: () => { throw new Error('Storage unavailable') },
      setItem: () => { throw new Error('Storage unavailable') },
    }

    expect(readLanguage(storage)).toBe('vi')
    expect(storeLanguage(storage, 'en')).toBe(false)
  })
})
