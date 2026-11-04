export const LANGUAGE_STORAGE_KEY = 'uth-online-judge-language'

export type SupportedLanguage = 'vi' | 'en'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export function parseLanguage(value: string | null): SupportedLanguage {
  return value === 'en' || value === 'vi' ? value : 'vi'
}

export function readLanguage(storage: PreferenceStorage): SupportedLanguage {
  try {
    return parseLanguage(storage.getItem(LANGUAGE_STORAGE_KEY))
  } catch {
    return 'vi'
  }
}

export function storeLanguage(storage: PreferenceStorage, language: SupportedLanguage): boolean {
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language)
    return true
  } catch {
    return false
  }
}
