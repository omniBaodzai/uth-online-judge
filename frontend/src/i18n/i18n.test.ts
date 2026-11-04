import { describe, expect, it } from 'vitest'
import { LANGUAGE_STORAGE_KEY, parseLanguage, readLanguage, storeLanguage } from './language'

describe('language preferences', () => {
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
