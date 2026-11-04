export const THEME_STORAGE_KEY = 'uth-online-judge-theme'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export function parseThemeMode(value: string | null): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function readThemeMode(storage: PreferenceStorage): ThemeMode {
  try {
    return parseThemeMode(storage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function storeThemeMode(storage: PreferenceStorage, mode: ThemeMode): boolean {
  try {
    storage.setItem(THEME_STORAGE_KEY, mode)
    return true
  } catch {
    return false
  }
}

export function resolveTheme(
  mode: ThemeMode,
  prefersDark: boolean,
): ResolvedTheme {
  return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor) themeColor.content = theme === 'dark' ? '#102426' : '#008689'
}
