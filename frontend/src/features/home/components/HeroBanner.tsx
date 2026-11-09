import { Link } from 'react-router-dom'
import styles from './HeroBanner.module.css'
import FloatingCodeParticles from './FloatingCodeParticles'
import PlatformStats from './PlatformStats'
import heroBackground from '../../../assets/uth_banner.jpg'
import { useTranslation } from 'react-i18next'

function HeroBanner() {
  const { t } = useTranslation('home')
  return (
    <section
      className={styles.hero}
      aria-labelledby="hero-title"
    >
      <div
        className={styles.background}
        style={{ backgroundImage: `url("${heroBackground}")` }}
        aria-hidden="true"
      />
      <FloatingCodeParticles />
      <div className={styles.heroContent}>
        <h1 className={styles.title} id="hero-title">
          <span className={styles.titleLine}>{t('heroTitleLine1')}</span>
          <span className={`${styles.titleLine} ${styles.titleAccent}`}>{t('heroTitleLine2')}</span>
        </h1>
        <p className={styles.description}>
          {t('heroDescription')}
        </p>
        <div className={styles.actions}>
          <Link className={styles.primaryAction} to="/problems">
            {t('exploreProblems')}
          </Link>
          <Link className={styles.secondaryAction} to="/contests">
            {t('joinContest')}
          </Link>
        </div>
      </div>
      <PlatformStats />
    </section>
  )
}

export default HeroBanner
