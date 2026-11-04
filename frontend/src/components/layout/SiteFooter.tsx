import { Link } from 'react-router-dom'
import styles from './SiteFooter.module.css'
import uthLogo from '../../assets/uth_logo.png'
import { CONTACT_EMAIL } from '../../config/contact'
import { useTranslation } from 'react-i18next'

function SiteFooter() {
  const { t } = useTranslation('common')
  return (
    <footer className={styles.footer} id="contact">
      <div className={styles.footerInner}>
        <div className={styles.brandColumn}>
          <h2>{t('footerGeneral')}</h2>
          <Link className={styles.brand} to="/" aria-label={t('homeLabel')}>
            <img src={uthLogo} alt="" />
          </Link>
          <div className={styles.descriptionList}>
            <p>{t('footerDescription1')}</p>
            <p>{t('footerDescription2')}</p>
            <p>{t('footerDescription3')}</p>
          </div>
        </div>
        <div className={styles.footerColumn}>
          <h2>{t('footerContact')}</h2>
          <a href={`mailto:${CONTACT_EMAIL}`}>Email: {CONTACT_EMAIL}</a>
          <span>{t('institution')}</span>
          <span>{t('university')}</span>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Ho%20tro%20UTH%20Online%20Judge`}>
            {t('sendSupport')}
          </a>
        </div>
        <div className={styles.footerColumn}>
          <h2>{t('footerPolicies')}</h2>
          <span>{t('policyStudy')}</span>
          <span>{t('policyPrivacy')}</span>
          <span>{t('policyAcademic')}</span>
          <span>{t('policyCommunity')}</span>
        </div>
        <div className={styles.footerColumn}>
          <h2>{t('footerGuide')}</h2>
          <Link to="/problems">{t('guideProblems')}</Link>
          <Link to="/contests">{t('guideContests')}</Link>
          <Link to="/submissions">{t('guideSubmissions')}</Link>
          <a href="#community">{t('guideCommunity')}</a>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Bao%20loi%20UTH%20Online%20Judge`}>
            {t('guideReport')}
          </a>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>&copy; {new Date().getFullYear()} UTH Online Judge. {t('copyright')}</p>
      </div>
    </footer>
  )
}

export default SiteFooter
