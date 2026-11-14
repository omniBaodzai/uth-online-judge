import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../auth/api'
import UserAvatar from '../../profile/components/UserAvatar'
import {
  addOrganizationMember,
  changeOrganizationMemberRole,
  listOrganizationMembers,
  memberActions,
  removeOrganizationMember,
  type AssignableRole,
  type OrganizationMember,
  type OrganizationMemberRole,
  type Page,
} from '../organizations-api'
import { useOrganizationsApi } from '../useOrganizationsApi'
import OrganizationTabState from './OrganizationTabState'
import { Users } from 'lucide-react'
import styles from '../pages/OrganizationDetailPage.module.css'

const PAGE_SIZE = 10

const roleKeys: Record<OrganizationMemberRole, string> = {
  OWNER: 'organizationRoleOwner',
  ADMIN: 'organizationRoleAdmin',
  MEMBER: 'organizationRoleMember',
}

type Pending =
  | { kind: 'remove'; member: OrganizationMember }
  | { kind: 'role'; member: OrganizationMember; role: AssignableRole }

type Props = {
  slug: string
  viewer: { id: string; isSystemAdmin: boolean; role: OrganizationMemberRole | null }
  archived: boolean
  showOwnerNote?: boolean
  adminDetail?: boolean
  // Gọi sau khi danh sách thay đổi để trang cha cập nhật memberCount.
  onChanged?: () => void
}

function MemberManager({
  slug,
  viewer,
  archived,
  showOwnerNote = true,
  adminDetail = false,
  onChanged,
}: Props) {
  const { t } = useTranslation('pages')
  const api = useOrganizationsApi()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<OrganizationMemberRole | ''>('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState<{ key: string; data: Page<OrganizationMember> | null } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [newRole, setNewRole] = useState<AssignableRole>('MEMBER')

  const key = `${slug}|${search}|${role}|${page}|${reloadKey}`
  const current = result?.key === key ? result : null
  const loading = current === null
  const canAdd = !archived && (viewer.isSystemAdmin || viewer.role === 'OWNER' || viewer.role === 'ADMIN')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(q.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [q])

  useEffect(() => {
    const controller = new AbortController()
    listOrganizationMembers(api, slug, { page, pageSize: PAGE_SIZE, q: search || undefined, role: role || undefined }, controller.signal)
      .then((data) => setResult({ key, data }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, data: null })
      })
    return () => controller.abort()
  }, [api, slug, page, search, role, key])

  const fail = useCallback((caught: unknown) => {
    let text = t('organizationMembershipError')
    if (caught instanceof ApiError) {
      if (caught.status === 401) text = t('organizationMembershipSession')
      else if (caught.status === 403) text = t('organizationMembershipForbidden')
      else if (caught.message) text = caught.message
    }
    setMessage({ kind: 'error', text })
  }, [t])

  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage({ kind: 'success', text: success })
      setPending(null)
      setReloadKey((value) => value + 1)
      onChanged?.()
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    const value = identifier.trim()
    if (!value) return
    void run(async () => {
      await addOrganizationMember(api, slug, value, newRole)
      setIdentifier('')
    }, t('membersMgmtAdded'))
  }

  function confirmPending() {
    if (!pending) return
    if (pending.kind === 'remove') {
      void run(() => removeOrganizationMember(api, slug, pending.member.id), t('membersMgmtRemoved'))
    } else {
      void run(() => changeOrganizationMemberRole(api, slug, pending.member.id, pending.role), t('membersMgmtRoleChanged'))
    }
  }

  const data = current?.data ?? null
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const nameOf = (member: OrganizationMember) => member.fullName || member.username || '—'

  return (
    <section className={`${styles.card} ${adminDetail ? styles.adminDetailManager : ''}`} aria-labelledby="member-manager-title">
      <h2 id="member-manager-title">{t('membersMgmtTitle')}</h2>
      {archived && <p className={styles.note} role="status">{t('membersMgmtArchived')}</p>}

      {canAdd && (
        <form
          className={`${styles.memberToolbar} ${adminDetail ? styles.adminAddForm : ''}`}
          onSubmit={handleAdd}
          aria-labelledby={adminDetail ? 'member-add-title' : undefined}
        >
          {adminDetail && <h3 className={styles.adminGroupTitle} id="member-add-title">{t('membersMgmtAddGroup')}</h3>}
          <label>
            <span>{t('membersMgmtIdentifier')}</span>
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} maxLength={254} autoComplete="off" />
          </label>
          <label>
            <span>{t('membersMgmtRole')}</span>
            <select value={newRole} onChange={(event) => setNewRole(event.target.value as AssignableRole)} disabled={!viewer.isSystemAdmin && viewer.role === 'ADMIN'}>
              <option value="MEMBER">{t(roleKeys.MEMBER)}</option>
              {(viewer.isSystemAdmin || viewer.role === 'OWNER') && <option value="ADMIN">{t(roleKeys.ADMIN)}</option>}
            </select>
          </label>
          <button className={styles.joinButton} type="submit" disabled={busy || identifier.trim() === ''}>
            {t('membersMgmtAddSubmit')}
          </button>
        </form>
      )}

      <div
        className={`${styles.memberToolbar} ${adminDetail ? styles.adminDetailFilters : ''}`}
        role={adminDetail ? 'group' : undefined}
        aria-labelledby={adminDetail ? 'member-filters-title' : undefined}
      >
        {adminDetail && <h3 className={styles.adminGroupTitle} id="member-filters-title">{t('membersMgmtFilterGroup')}</h3>}
        <label>
          <span>{t('membersMgmtSearch')}</span>
          <input type="search" value={q} onChange={(event) => setQ(event.target.value)} maxLength={100} />
        </label>
        <label>
          <span>{t('membersMgmtRole')}</span>
          <select value={role} onChange={(event) => { setRole(event.target.value as OrganizationMemberRole | ''); setPage(1) }}>
            <option value="">{t('membersMgmtAllRoles')}</option>
            {(['OWNER', 'ADMIN', 'MEMBER'] as const).map((value) => <option key={value} value={value}>{t(roleKeys[value])}</option>)}
          </select>
        </label>
      </div>

      {message && <p className={styles.note} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}

      {pending && (
        <div className={styles.confirmBar} role="alertdialog" aria-label={t('membersMgmtConfirm')}>
          <span>
            {pending.kind === 'remove'
              ? t('membersMgmtRemoveConfirm', { name: nameOf(pending.member) })
              : t('membersMgmtRoleConfirm', { name: nameOf(pending.member), role: t(roleKeys[pending.role]) })}
          </span>
          <button className={styles.joinButton} type="button" onClick={confirmPending} disabled={busy}>{t('membersMgmtConfirm')}</button>
          <button className={styles.secondaryButton} type="button" onClick={() => setPending(null)} disabled={busy}>{t('membersMgmtCancel')}</button>
        </div>
      )}

      <div
        className={adminDetail ? styles.adminMemberList : undefined}
        role={adminDetail ? 'group' : undefined}
        aria-labelledby={adminDetail ? 'member-list-title' : undefined}
      >
        {adminDetail && <h3 className={styles.adminGroupTitle} id="member-list-title">{t('membersMgmtListGroup')}</h3>}
        {loading ? (
          <OrganizationTabState kind="loading" icon={Users} />
        ) : !data ? (
          <p className={styles.note} role="alert">{t('membersMgmtLoadFailed')}</p>
        ) : data.items.length === 0 ? (
          <p className={styles.empty}>{t('membersMgmtEmpty')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('organizationTabMembers')}</th>
                  <th scope="col">{t('organizationMemberRoleHeading')}</th>
                  <th scope="col">{t('membersMgmtActions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((member) => {
                  const isSelf = member.id === viewer.id
                  const actions = archived
                    ? { canChangeRole: false, canRemove: false }
                    : memberActions(viewer, member.role, isSelf)
                  const target: AssignableRole = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'
                  return (
                    <tr key={member.id}>
                      <td>
                        {adminDetail ? (
                          <div className={styles.adminMemberIdentity}>
                            <UserAvatar source={member.avatarUrl} username={nameOf(member)} label={nameOf(member)} />
                            <span>{nameOf(member)}{isSelf && <small> {t('membersMgmtYou')}</small>}</span>
                          </div>
                        ) : (
                          <>
                            <UserAvatar source={member.avatarUrl} username={nameOf(member)} label={nameOf(member)} /> {nameOf(member)}
                            {isSelf && <small> {t('membersMgmtYou')}</small>}
                          </>
                        )}
                      </td>
                      <td>
                        {adminDetail
                          ? <span className={styles.adminRoleBadge}>{t(roleKeys[member.role])}</span>
                          : t(roleKeys[member.role])}
                      </td>
                      <td className={`${styles.rowActions} ${adminDetail ? styles.adminRowActions : ''}`}>
                        {actions.canChangeRole && (
                          <button className={styles.secondaryButton} type="button" disabled={busy}
                            onClick={() => setPending({ kind: 'role', member, role: target })}>
                            {t(roleKeys[target])}
                          </button>
                        )}
                        {actions.canRemove && (
                          <button className={styles.dangerButton} type="button" disabled={busy}
                            onClick={() => setPending({ kind: 'remove', member })}>
                            {t('membersMgmtRemove')}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > PAGE_SIZE && (
          <div className={`${styles.memberToolbar} ${adminDetail ? styles.adminMemberPagination : ''}`}>
            <button className={styles.secondaryButton} type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('membersMgmtPrev')}</button>
            <span>{t('membersMgmtPage', { page, total: totalPages })}</span>
            <button className={styles.secondaryButton} type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('membersMgmtNext')}</button>
          </div>
        )}
      </div>
      {showOwnerNote && <p className={styles.note}>{t('membersMgmtOwnerNote')}</p>}
    </section>
  )
}

export default MemberManager
