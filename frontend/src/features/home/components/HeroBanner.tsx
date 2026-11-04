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
      style={{ backgroundImage: `url("${heroBackground}")` }}
      aria-labelledby="hero-title"
    >
      <FloatingCodeParticles />
      <div className={styles.heroContent}>
        <h1 className={styles.title} id="hero-title">
          {t('heroTitle')}
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
