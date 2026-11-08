import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Building2, ChartNoAxesColumn, FileText, Info, Send, ShieldAlert, Trophy, Users, Eye,
} from 'lucide-react'
import { buildLoginPath } from '../../auth/return-path'
import { useAuth } from '../../auth/useAuth'
import MemberManager from '../components/MemberManager'
import OrganizationContentPanel from '../components/OrganizationContentPanel'
import OrganizationSubmissionsPanel from '../components/OrganizationSubmissionsPanel'
import OrganizationTabState from '../components/OrganizationTabState'
import {
  emptyToNull,
  errorMessage,
  getOrganizationManage,
  updateOrganizationInfo,
  updateOrganizationVisibility,
  type OrganizationDetail,
  type OrganizationVisibility,
  type VisibilityInput,
} from '../organizations-api'
import { useOrganizationDetail } from '../useOrganizationDetail'
import { useOrganizationsApi } from '../useOrganizationsApi'
import styles from './OrganizationDetailPage.module.css'

const sections = [
  { id: 'overview', labelKey: 'organizationManageOverview', Icon: ChartNoAxesColumn },
  { id: 'info', labelKey: 'organizationManageInfo', Icon: Info },
  { id: 'members', labelKey: 'organizationManageMembers', Icon: Users },
  { id: 'problems', labelKey: 'organizationManageProblems', Icon: FileText },
  { id: 'contests', labelKey: 'organizationManageContests', Icon: Trophy },
  { id: 'submissions', labelKey: 'organizationManageSubmissions', Icon: Send },
  { id: 'visibility', labelKey: 'organizationManageVisibility', Icon: Eye },
] as const

type SectionId = (typeof sections)[number]['id']

const visibilityItems = [
  { id: 'problems', key: 'problemsVisibility', labelKey: 'organizationVisibilityProblems' },
  { id: 'contests', key: 'contestsVisibility', labelKey: 'organizationVisibilityContests' },
  { id: 'submissions', key: 'submissionsVisibility', labelKey: 'organizationVisibilitySubmissions' },
] as const

type PanelProps = { organization: OrganizationDetail; onSaved: (organization: OrganizationDetail) => void }

function InfoForm({ organization, onSaved }: PanelProps) {
  const { t } = useTranslation('pages')
  const api = useOrganizationsApi()
  const navigate = useNavigate()
  const editable = organization.viewerPermissions.canEditInfo
  const [name, setName] = useState(organization.name)
  const [slug, setSlug] = useState(organization.slug)
  const [description, setDescription] = useState(organization.description ?? '')
  const [website, setWebsite] = useState(organization.websiteUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving || !editable) return
    setSaving(true)
    setMessage(null)
    try {
      const updated = await updateOrganizationInfo(api, organization.slug, {
        name: name.trim(),
        slug: slug.trim(),
        description: emptyToNull(description),
        websiteUrl: emptyToNull(website),
      })
      onSaved(updated)
      setMessage({ kind: 'success', text: t('organizationManageSaved') })
      if (updated.slug !== organization.slug) {
        navigate(`/organizations/${encodeURIComponent(updated.slug)}/manage`, { replace: true })
      }
    } catch (caught) {
      setMessage({ kind: 'error', text: errorMessage(caught, t('organizationManageSaveError')) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.card} aria-labelledby="manage-info-title">
      <h2 id="manage-info-title">{t('organizationManageInfo')}</h2>
      <form className={styles.formStack} onSubmit={handleSubmit}>
        <div>
          <label htmlFor="manage-name">{t('organizationManageName')}</label>
          <input id="manage-name" value={name} maxLength={150} required disabled={!editable || saving} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label htmlFor="manage-slug">{t('organizationManageSlug')}</label>
          <input id="manage-slug" value={slug} maxLength={80} required disabled={!editable || saving} onChange={(event) => setSlug(event.target.value)} />
        </div>
        <div>
          <label htmlFor="manage-description">{t('organizationManageDescription')}</label>
          <textarea id="manage-description" rows={4} maxLength={2000} value={description} disabled={!editable || saving} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <div>
          <label htmlFor="manage-website">{t('organizationManageWebsite')}</label>
          <input id="manage-website" type="url" maxLength={500} value={website} disabled={!editable || saving} onChange={(event) => setWebsite(event.target.value)} />
        </div>
        {message && <p className={styles.note} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
        <div className={styles.manageActions}>
          <button className={styles.joinButton} type="submit" disabled={!editable || saving}>
            {saving ? t('organizationManageSaving') : t('organizationManageSave')}
          </button>
          {!editable && <span className={styles.note}>{t('organizationManageReadOnly')}</span>}
        </div>
      </form>
    </section>
  )
}

function VisibilityForm({ organization, onSaved }: PanelProps) {
  const { t } = useTranslation('pages')
  const api = useOrganizationsApi()
  const editable = organization.viewerPermissions.canEditVisibility
  const [values, setValues] = useState<Record<keyof VisibilityInput, OrganizationVisibility>>({
    problemsVisibility: organization.problemsVisibility,
    contestsVisibility: organization.contestsVisibility,
    submissionsVisibility: organization.submissionsVisibility,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving || !editable) return
    setSaving(true)
    setMessage(null)
    try {
      onSaved(await updateOrganizationVisibility(api, organization.slug, values))
      setMessage({ kind: 'success', text: t('organizationManageSaved') })
    } catch (caught) {
      setMessage({ kind: 'error', text: errorMessage(caught, t('organizationManageSaveError')) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.card} aria-labelledby="manage-visibility-title">
      <h2 id="manage-visibility-title">{t('organizationManageVisibility')}</h2>
      <p className={styles.note}>{t('organizationVisibilityHint')}</p>
      <form onSubmit={handleSubmit}>
        <ul className={styles.visibilityList}>
          {visibilityItems.map(({ id, key, labelKey }) => (
            <li className={styles.visibilityItem} key={id}>
              <div>
                <strong id={`visibility-${id}`}>{t(labelKey)}</strong>
                <p>{t('organizationVisibilityPublicHelp')} / {t('organizationVisibilityPrivateHelp')}</p>
              </div>
              <div className={styles.segment} role="radiogroup" aria-labelledby={`visibility-${id}`}>
                {(['PUBLIC', 'PRIVATE'] as const).map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={`visibility-${id}`}
                      checked={values[key] === option}
                      disabled={!editable || saving}
                      onChange={() => setValues((current) => ({ ...current, [key]: option }))}
                    />
                    {t(option === 'PUBLIC' ? 'organizationVisibilityPublic' : 'organizationVisibilityPrivate')}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {message && <p className={styles.note} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
        <div className={styles.manageActions}>
          <button className={styles.joinButton} type="submit" disabled={!editable || saving}>
            {saving ? t('organizationManageSaving') : t('organizationManageSave')}
          </button>
          {!editable && <span className={styles.note}>{t('organizationManageReadOnly')}</span>}
        </div>
      </form>
    </section>
  )
}

function OrganizationManagePage() {
  const { t, i18n } = useTranslation('pages')
  const api = useOrganizationsApi()
  const { user } = useAuth()
  const { organizationId = '' } = useParams()
  const [section, setSection] = useState<SectionId>('overview')
  const { state, replace } = useOrganizationDetail(organizationId, 'manage')
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'

  if (state.status !== 'ready') {
    if (state.status === 'loading') {
      return (
        <main className={styles.main} id="main-content">
          <div className={styles.container}><OrganizationTabState kind="loading" icon={Building2} /></div>
        </main>
      )
    }
    const missing = state.status === 'notFound'
    const unauthorized = state.status === 'unauthorized'
    const failed = state.status === 'error'
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          <section className={`${styles.card} ${styles.notFound}`}>
            {missing ? <Building2 size={32} aria-hidden="true" /> : <ShieldAlert size={32} aria-hidden="true" />}
            <h1>{t(missing ? 'organizationNotFoundTitle' : failed ? 'organizationTabErrorTitle' : 'organizationManageForbiddenTitle')}</h1>
            <p>{t(missing ? 'organizationNotFoundText' : failed ? 'organizationTabErrorText' : unauthorized ? 'organizationManageLoginText' : 'organizationManageForbiddenText')}</p>
            {unauthorized ? (
              <Link to={buildLoginPath(`/organizations/${encodeURIComponent(organizationId)}/manage`)}>{t('organizationRequestLogin')}</Link>
            ) : (
              <Link to={missing ? '/organizations' : `/organizations/${encodeURIComponent(organizationId)}`}>
                {t(missing ? 'organizationBackToList' : 'organizationManageBack')}
              </Link>
            )}
          </section>
        </div>
      </main>
    )
  }

  const organization = state.organization
  const archived = organization.status === 'ARCHIVED'
  const stats: Array<{ label: string; value: string | null }> = [
    { label: t('organizationMemberCount'), value: organization.memberCount.toLocaleString(locale) },
    { label: t('organizationManageProblems'), value: null },
    { label: t('organizationManageContests'), value: null },
    { label: t('organizationManageSubmissions'), value: null },
  ]
  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        {archived && <p className={styles.archivedNotice} role="status">{t('organizationArchivedNotice')}</p>}
        <header className={styles.pageHeader}>
          <h1 className={styles.title}>{organization.name}</h1>
          <nav className={styles.tabsViewport} aria-label={t('organizationManageNav')}>
            <div className={styles.tabs}>
              {sections.map(({ id, labelKey, Icon }) => (
                <button
                  key={id}
                  className={`${styles.tab} ${section === id ? styles.activeTab : ''}`}
                  type="button"
                  aria-current={section === id ? 'page' : undefined}
                  onClick={() => setSection(id)}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{t(labelKey)}</span>
                </button>
              ))}
            </div>
          </nav>
        </header>

        {section === 'overview' && (
          <section className={styles.card} aria-labelledby="manage-overview-title">
            <h2 id="manage-overview-title">{t('organizationManageOverview')}</h2>
            <dl className={styles.manageGrid}>
              <div className={styles.stat}>
                <dt>{t('organizationManageStatus')}</dt>
                <dd>
                  <span className={`${styles.statusBadge} ${archived ? styles.statusArchived : ''}`}>
                    {archived ? t('organizationStatusArchived') : organization.status === 'ACTIVE' ? t('organizationStatusActive') : t('organizationManageUnknown')}
                  </span>
                </dd>
              </div>
              {stats.map(({ label, value }) => (
                <div className={styles.stat} key={label}>
                  <dt>{label}</dt>
                  <dd>{value ?? '—'}{value === null && <small>{t('organizationStatCount')}</small>}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {section === 'info' && <InfoForm organization={organization} onSaved={replace} />}

        {section === 'members' && (
          <MemberManager
            slug={organization.slug}
            archived={archived}
            viewer={{ id: user?.id ?? '', isSystemAdmin: user?.role === 'ADMIN', role: organization.viewerRole }}
            onChanged={() => { void getOrganizationManage(api, organization.slug).then(replace).catch(() => undefined) }}
          />
        )}

        {(section === 'problems' || section === 'contests') && (
          <OrganizationContentPanel
            slug={organization.slug}
            section={section}
            canManage={organization.viewerPermissions.canManage}
            archived={archived}
          />
        )}

        {section === 'submissions' && (
          <OrganizationSubmissionsPanel
            slug={organization.slug}
            canViewSubmissions={organization.viewerPermissions.canViewSubmissions}
          />
        )}

        {section === 'visibility' && <VisibilityForm organization={organization} onSaved={replace} />}
      </div>
    </main>
  )
}

export default OrganizationManagePage
