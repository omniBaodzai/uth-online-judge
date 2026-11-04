import type { TFunction } from 'i18next'

export function communityText(
  t: TFunction<'pages'>,
  language: string,
  key: string,
  vi: string,
  en: string,
  values: Record<string, string | number> = {},
): string {
  return t(`community.${key}`, {
    ...values,
    defaultValue: language.startsWith('en') ? en : vi,
  })
}
