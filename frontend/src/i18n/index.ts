import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './locales'
import { parseLanguage, readLanguage, storeLanguage, type SupportedLanguage } from './language'

function readStoredLanguage(): SupportedLanguage {
  try {
    return readLanguage(window.localStorage)
  } catch {
    return 'vi'
  }
}

const initialLanguage = readStoredLanguage()

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'vi',
  defaultNS: 'common',
  ns: ['common', 'home', 'auth', 'pages'],
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (language) => {
  const normalized = parseLanguage(language)
  document.documentElement.lang = normalized
  try { storeLanguage(window.localStorage, normalized) } catch { /* Storage is optional. */ }
})

document.documentElement.lang = initialLanguage

export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language)
}

export default i18n
