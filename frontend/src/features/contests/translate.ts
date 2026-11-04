import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'

export function contestText(
  t: TFunction<'pages'>,
  language: string,
  key: string,
  vi: string,
  en: string,
  values: Record<string, string | number> = {},
): string {
  return t(`contests.${key}`, {
    ...values,
    defaultValue: language.startsWith('en') ? en : vi,
  })
}

export function useContestText() {
  const { t, i18n } = useTranslation('pages')
  const language = i18n.resolvedLanguage ?? i18n.language
  const locale = language.startsWith('en') ? 'en-US' : 'vi-VN'
  const text = useCallback(
    (key: string, vi: string, en: string, values: Record<string, string | number> = {}) =>
      contestText(t, language, key, vi, en, values),
    [t, language],
  )
  return { locale, text }
}
