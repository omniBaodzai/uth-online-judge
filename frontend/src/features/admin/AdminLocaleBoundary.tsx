import { useEffect, type ReactNode } from 'react'
import i18n from '../../i18n'

function AdminLocaleBoundary({ children }: { children: ReactNode }) {
  useEffect(() => {
    const enforceVietnameseDocumentLanguage = () => {
      document.documentElement.lang = 'vi'
    }

    enforceVietnameseDocumentLanguage()
    i18n.on('languageChanged', enforceVietnameseDocumentLanguage)
    return () => {
      i18n.off('languageChanged', enforceVietnameseDocumentLanguage)
      document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language
    }
  }, [])

  return children
}

export default AdminLocaleBoundary
