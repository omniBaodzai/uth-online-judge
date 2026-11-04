import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ThemeContext } from './ThemeContext'
import {
  applyTheme,
  readThemeMode,
  resolveTheme,
  storeThemeMode,
  type ThemeMode,
} from './theme'

function readStoredMode(): ThemeMode {
  try {
    return readThemeMode(window.localStorage)
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode)
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const resolvedTheme = resolveTheme(mode, prefersDark)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)')
    const updatePreference = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    preference.addEventListener('change', updatePreference)
    return () => preference.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  const setMode = useCallback((nextMode: ThemeMode) => {
    try { storeThemeMode(window.localStorage, nextMode) } catch { /* Storage is optional. */ }
    setModeState(nextMode)
  }, [])

  const value = useMemo(
    () => ({ mode, resolvedTheme, setMode }),
    [mode, resolvedTheme, setMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
