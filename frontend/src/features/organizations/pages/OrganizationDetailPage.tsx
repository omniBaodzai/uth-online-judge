import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Building2, FileText, Info, LogIn, Medal, Send, Settings, Trophy, Users, UserRoundPlus } from 'lucide-react'
import { ApiError } from '../../auth/api'
import { buildLoginPath } from '../../auth/return-path'
import { useAuth } from '../../auth/useAuth'
import UserAvatar from '../../profile/components/UserAvatar'
import OrganizationContentPanel from '../components/OrganizationContentPanel'
import OrganizationLeaderboardPanel from '../components/OrganizationLeaderboardPanel'
import OrganizationSubmissionsPanel from '../components/OrganizationSubmissionsPanel'
import OrganizationTabState from '../components/OrganizationTabState'
import {
  joinOrganization,
  leaveOrganization,
  listOrganizationMembers,
  type OrganizationDetail,
  type OrganizationMember,
  type OrganizationMemberRole,
} from '../organizations-api'
import { useOrganizationDetail } from '../useOrganizationDetail'
import { useOrganizationsApi } from '../useOrganizationsApi'
import styles from './OrganizationDetailPage.module.css'

const tabs = [
  { id: 'info', labelKey: 'organizationTabInfo', Icon: Info },
  { id: 'members', labelKey: 'organizationTabMembers', Icon: Users },
  { id: 'leaderboard', labelKey: 'organizationTabLeaderboard', Icon: Medal },
  { id: 'problems', labelKey: 'organizationTabProblems', Icon: FileText },
  { id: 'contests', labelKey: 'organizationTabContests', Icon: Trophy },
  { id: 'submissions', labelKey: 'organizationTabSubmissions', Icon: Send },
] as const

type TabId = (typeof tabs)[number]['id']

const roleKeys: Record<OrganizationMemberRole, string> = {
  OWNER: 'organizationRoleOwner',
  ADMIN: 'organizationRoleAdmin',
  MEMBER: 'organizationRoleMember',
}

function MembershipActions({
  organization,
  onChanged,
  onNotice,
}: {
  organization: OrganizationDetail
  onChanged: (organization: OrganizationDetail) => void
  onNotice: (notice: { kind: 'error' | 'success'; text: string } | null) => void
}) {
  const { t } = useTranslation('pages')
  const api = useOrganizationsApi()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const role = organization.viewerRole
  const archived = organization.status === 'ARCHIVED'

  async function run(action: typeof joinOrganization, success: string) {
    if (busy) return
    setBusy(true)
    onNotice(null)
    try {
      onChanged(await action(api, organization.slug))
      onNotice({ kind: 'success', text: success })
      setConfirming(false)
    } catch (caught) {
      let text = t('organizationMembershipError')
      if (caught instanceof ApiError) {
        if (caught.status === 401) text = t('organizationMembershipSession')
        else if (caught.status === 409 && caught.message) text = caught.message
      }
      onNotice({ kind: 'error', text })
    } finally {
      setBusy(false)
    }
  }

  if (role) {
    return (
      <>
        <p className={styles.note}>{t('organizationYourRole')}: <strong>{t(roleKeys[role])}</strong></p>
        {role === 'OWNER' ? (
          <p className={styles.note}>{t('organizationOwnerCannotLeave')}</p>
        ) : confirming ? (
          <div className={styles.confirmBar} role="alertdialog" aria-label={t('organizationLeave')}>
            <span>{t('organizationLeaveConfirm')}</span>
            <button className={styles.dangerButton} type="button" disabled={busy} onClick={() => void run(leaveOrganization, t('organizationLeaveDone'))}>
              {t('organizationLeave')}
            </button>
            <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setConfirming(false)}>
              {t('membersMgmtCancel')}
            </button>
          </div>
        ) : (
          <button className={styles.dangerButton} type="button" disabled={busy || archived} onClick={() => setConfirming(true)}>
            {t('organizationLeave')}
          </button>
        )}
      </>
    )
  }
  return (
    <button className={styles.joinButton} type="button" disabled={busy || archived} onClick={() => void run(joinOrganization, t('organizationJoinDone'))}>
      <UserRoundPlus size={17} aria-hidden="true" />
      <span>{t('organizationJoin')}</span>
    </button>
  )
}

function MembersPanel({ slug, version }: { slug: string; version: number }) {
  const { t } = useTranslation('pages')
  const api = useOrganizationsApi()
  const [items, setItems] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailed(false)
    listOrganizationMembers(api, slug, { page: 1, pageSize: 50 }, controller.signal)
      .then((result) => setItems(result.items))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [api, slug, version])

  if (loading) return <OrganizationTabState kind="loading" icon={Users} />
  if (failed) return <OrganizationTabState kind="error" icon={Users} />
  if (items.length === 0) return <OrganizationTabState kind="empty" icon={Users} emptyText={t('organizationTabNoData_members')} />
  return (
    <section className={styles.card} aria-label={t('organizationTabMembers')}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('organizationTabMembers')}</th>
              <th scope="col">{t('organizationMemberRoleHeading')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((member) => {
              const name = member.fullName || member.username || '—'
              return (
                <tr key={member.id}>
                  <td>
                    <UserAvatar source={member.avatarUrl} username={name} label={name} />{' '}
                    {member.username ? (
                      <Link to={`/users/${encodeURIComponent(member.username)}`}>{name}</Link>
                    ) : name}
                  </td>
                  <td>{t(roleKeys[member.role])}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function OrganizationDetailPage() {
  const { t, i18n } = useTranslation('pages')
  const { organizationId = '' } = useParams()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('info')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const { state, replace } = useOrganizationDetail(organizationId, 'public')
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'

  if (state.status !== 'ready') {
    const loading = state.status === 'loading'
    const failed = state.status === 'error'
    return (
      <main className={styles.main} id="main-content">
        <div className={styles.container}>
          {loading ? (
            <OrganizationTabState kind="loading" icon={Building2} />
          ) : failed ? (
            <OrganizationTabState kind="error" icon={Building2} />
          ) : (
            <section className={`${styles.card} ${styles.notFound}`}>
              <Building2 size={32} aria-hidden="true" />
              <h1>{t('organizationNotFoundTitle')}</h1>
              <p>{t('organizationNotFoundText')}</p>
              <Link to="/organizations">{t('organizationBackToList')}</Link>
            </section>
          )}
        </div>
      </main>
    )
  }
  const organization = state.organization
  const permissions = organization.viewerPermissions

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }
    const next = keys[event.key]
    if (next === undefined) return
    event.preventDefault()
    setActiveTab(tabs[next].id)
    tabRefs.current[next]?.focus()
  }

  const loginPath = buildLoginPath(`/organizations/${encodeURIComponent(organization.slug)}`)
  const canManage = permissions.canManage

  return (
    <main className={styles.main} id="main-content">
      <div className={styles.container}>
        {organization.status === 'ARCHIVED' && <p className={styles.archivedNotice} role="status">{t('organizationArchivedNotice')}</p>}
        <header className={styles.pageHeader}>
          <h1 className={styles.title}>{organization.name}</h1>
          <div className={styles.tabsViewport}>
            <div className={styles.tabs} role="tablist" aria-label={t('organizationTabsLabel')}>
              {tabs.map(({ id, labelKey, Icon }, index) => (
                <button
                  key={id}
                  ref={(element) => { tabRefs.current[index] = element }}
                  id={`organization-tab-${id}`}
                  className={`${styles.tab} ${activeTab === id ? styles.activeTab : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  aria-controls={`organization-panel-${id}`}
                  tabIndex={activeTab === id ? 0 : -1}
                  onClick={() => setActiveTab(id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{t(labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {tabs.map(({ id }) => (
          <div
            key={id}
            id={`organization-panel-${id}`}
            role="tabpanel"
            aria-labelledby={`organization-tab-${id}`}
            hidden={activeTab !== id}
          >
            {activeTab === id && id === 'info' && (
              <div className={styles.infoLayout}>
                <section className={styles.card} aria-labelledby="organization-info-title">
                  <h2 id="organization-info-title">{t('organizationInfoTitle')}</h2>
                  <dl className={styles.details}>
                    <div>
                      <dt>{t('organizationWebsite')}</dt>
                      <dd>
                        {organization.websiteUrl
                          ? <a href={organization.websiteUrl} target="_blank" rel="noopener noreferrer">{organization.websiteUrl}</a>
                          : <span className={styles.empty}>{t('organizationWebsiteEmpty')}</span>}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('organizationDescription')}</dt>
                      <dd>
                        {organization.description
                          ? <p>{organization.description}</p>
                          : <span className={styles.empty}>{t('organizationDescriptionEmpty')}</span>}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('organizationMemberCount')}</dt>
                      <dd>{organization.memberCount.toLocaleString(locale)}</dd>
                    </div>
                  </dl>
                </section>

                <aside className={`${styles.card} ${styles.joinCard}`} aria-labelledby="organization-join-title">
                  <h2 id="organization-join-title">{t('organizationJoinTitle')}</h2>
                  {user ? (
                    <MembershipActions
                      organization={organization}
                      onChanged={replace}
                      onNotice={setNotice}
                    />
                  ) : (
                    <Link className={styles.joinButton} to={loginPath}>
                      <LogIn size={17} aria-hidden="true" />
                      <span>{t('organizationLoginToJoin')}</span>
                    </Link>
                  )}
                  {notice && <p className={styles.note} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
                  {canManage && (
                    <Link className={styles.manageLink} to={`/organizations/${encodeURIComponent(organization.slug)}/manage`}>
                      <Settings size={17} aria-hidden="true" />
                      <span>{t('organizationManageLink')}</span>
                    </Link>
                  )}
                </aside>
              </div>
            )}
            {activeTab === id && id === 'members' && <MembersPanel slug={organization.slug} version={organization.memberCount} />}
            {activeTab === id && id === 'leaderboard' && <OrganizationLeaderboardPanel slug={organization.slug} />}
            {activeTab === id && (id === 'problems' || id === 'contests') && (
              permissions[id === 'problems' ? 'canViewProblems' : 'canViewContests'] ? (
                <OrganizationContentPanel
                  slug={organization.slug}
                  section={id}
                  canManage={canManage}
                  archived={organization.status === 'ARCHIVED'}
                />
              ) : (
                <OrganizationTabState kind="private" icon={tabs.find((tab) => tab.id === id)?.Icon ?? Info} />
              )
            )}
            {activeTab === id && id === 'submissions' && (
              <OrganizationSubmissionsPanel
                slug={organization.slug}
                canViewSubmissions={permissions.canViewSubmissions}
              />
            )}
          </div>
        ))}
      </div>
    </main>
  )
}

export default OrganizationDetailPage
