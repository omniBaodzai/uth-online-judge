import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import illustration from '../../assets/not-found-illustration.webp'
import styles from './NotFoundPage.module.css'

function NotFoundPage() {
  const { t } = useTranslation('pages')
  const title = t('notFoundDocumentTitle')
  const previousTitle = useRef<string | null>(null)
  const appliedTitle = useRef('')

  useEffect(() => {
    previousTitle.current ??= document.title
    document.title = title
    appliedTitle.current = title
  }, [title])

  useEffect(() => () => {
    if (previousTitle.current !== null && document.title === appliedTitle.current) {
      document.title = previousTitle.current
    }
  }, [])

  return (
    <main className={styles.main} id="main-content" data-page="not-found">
      <section className={styles.scene} aria-labelledby="not-found-heading">
        <img
          className={styles.illustration}
          src={illustration}
          alt={t('notFoundIllustrationAlt')}
          width={1366}
          height={768}
          decoding="async"
        />
        <div className={styles.content}>
          <p className={styles.code} aria-hidden="true">404</p>
          <h1 className={styles.heading} id="not-found-heading">
            {t('notFoundHeading')}
          </h1>
          <p className={styles.description}>{t('notFoundDescription')}</p>
        </div>
      </section>
    </main>
  )
}

export default NotFoundPage
