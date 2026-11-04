import { describe, expect, it } from 'vitest'
import { parseThemeMode, readThemeMode, resolveTheme, storeThemeMode, THEME_STORAGE_KEY } from './theme'

describe('theme preferences', () => {
  it('uses system mode for missing or invalid saved preferences', () => {
    expect(parseThemeMode(null)).toBe('system')
    expect(parseThemeMode('sepia')).toBe('system')
  })

  it('resolves system preference and preserves explicit light and dark modes', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('reads and persists the selected preference', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(storeThemeMode(storage, 'dark')).toBe(true)
    expect(values.get(THEME_STORAGE_KEY)).toBe('dark')
    expect(readThemeMode(storage)).toBe('dark')
  })

  it('falls back to system when storage is unavailable', () => {
    const storage = {
      getItem: () => { throw new Error('Storage unavailable') },
      setItem: () => { throw new Error('Storage unavailable') },
    }

    expect(readThemeMode(storage)).toBe('system')
    expect(storeThemeMode(storage, 'light')).toBe(false)
  })
})
