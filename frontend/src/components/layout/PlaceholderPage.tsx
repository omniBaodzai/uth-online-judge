import { useTranslation } from 'react-i18next'
import styles from './PlaceholderPage.module.css'

function PlaceholderPage({ titleKey }: { titleKey: 'organizations' | 'problemPdf' }) {
  const { t } = useTranslation('common')

  return (
    <main className={styles.main} id="main-content">
      <section className={styles.card} aria-labelledby="placeholder-title">
        <h1 id="placeholder-title">{t(titleKey)}</h1>
        <p>{t('placeholderUnderConstruction')}</p>
      </section>
    </main>
  )
}

export default PlaceholderPage
