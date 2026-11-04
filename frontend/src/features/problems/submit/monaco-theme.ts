import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../../../theme/useTheme'
import { monaco } from './monaco-setup'

export type MonacoThemeName = 'uth-light' | 'uth-dark'

export function monacoThemeFor(resolvedTheme: 'light' | 'dark', pathname: string): MonacoThemeName {
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  return resolvedTheme === 'dark' && !isAdmin ? 'uth-dark' : 'uth-light'
}

// Monaco themes are global, so one hook keeps every editor on the page in sync with the site theme.
export function useMonacoTheme(): MonacoThemeName {
  const { resolvedTheme } = useTheme()
  const { pathname } = useLocation()
  const name = monacoThemeFor(resolvedTheme, pathname)

  useEffect(() => {
    monaco.editor.setTheme(name)
  }, [name])

  return name
}
