import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  approveOrganizationRequest,
  archiveOrganization,
  changeOrganizationOwner,
  createAdminOrganization,
  emptyToNull,
  errorMessage,
  listAdminOrganizations,
  listAdminRequests,
  rejectOrganizationRequest,
  restoreOrganization,
  updateAdminOrganization,
  type AdminOrganization,
  type AdminOrganizationRequest,
  type OrganizationRequestStatus,
  type OrganizationStatus,
  type RequestStatistics,
} from '../../organizations/organizations-api'
import { useOrganizationsApi } from '../../organizations/useOrganizationsApi'
import { adminOrganizationPath } from './organization-detail-links'
import { adminOrganizationRequestPath } from './organization-request-links'
import styles from '../admin.module.css'

type Section = 'organizations' | 'requests'

const PAGE_SIZE = 10
const REQUEST_STATUS_LABEL: Record<OrganizationRequestStatus, string> = {
  PENDING: 'Chờ xử lý',
  APPROVED: 'Chấp thuận',
  REJECTED: 'Từ chối',
}
const REQUEST_STATUS_CLASS: Record<OrganizationRequestStatus, string> = {
  PENDING: styles.status_draft,
  APPROVED: styles.status_published,
  REJECTED: styles.status_inactive,
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('vi-VN')
const ownerLabel = (owner: AdminOrganization['owner']) =>
  owner ? owner.fullName || owner.username || owner.id : 'Chưa có OWNER'

function FormDialog({ title, submitLabel, danger, onClose, onSubmit, children }: {
  title: string
  submitLabel: string
  danger?: boolean
  onClose: () => void
  onSubmit: () => Promise<void>
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit()
    } catch (caught) {
      setError(errorMessage(caught, 'Thao tác không thành công. Vui lòng thử lại.'))
      setBusy(false)
    }
  }

  return (
    <div className={styles.dialogBackdrop} onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => event.key === 'Escape' && !busy && onClose()}
      >
        <h2>{title}</h2>
        <form className={styles.formStack} onSubmit={handleSubmit}>
          {children}
          {error && <p className={styles.formMessage} role="alert">{error}</p>}
          <div className={styles.dialogActions}>
            <button className={styles.buttonSecondary} type="button" disabled={busy} onClick={onClose}>Hủy</button>
            <button className={danger ? styles.buttonDanger : styles.buttonPrimary} type="submit" disabled={busy}>
              {busy ? 'Đang xử lý...' : submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className={styles.fieldHint}>{hint}</p>}
    </div>
  )
}

export function OrganizationDialog({ initial, onClose, onDone }: {
  initial?: AdminOrganizationRequest
  onClose: () => void
  onDone: (updated?: AdminOrganizationRequest) => void
}) {
  const api = useOrganizationsApi()
  const [name, setName] = useState(initial?.workplace.slice(0, 150) ?? '')
  const [slug, setSlug] = useState('')
  const [owner, setOwner] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [note, setNote] = useState('')

  async function submit() {
    const input = {
      name: name.trim(),
      slug: emptyToNull(slug) ?? undefined,
      ownerIdentifier: emptyToNull(owner),
      description: emptyToNull(description),
      websiteUrl: emptyToNull(website),
    }
    if (initial) {
      const updated = await approveOrganizationRequest(api, initial.id, { ...input, reviewNote: emptyToNull(note) })
      onDone(updated)
    } else {
      await createAdminOrganization(api, input)
      onDone()
    }
  }

  return (
    <FormDialog title={initial ? 'Duyệt yêu cầu tạo tổ chức' : 'Tạo tổ chức'} submitLabel={initial ? 'Duyệt' : 'Tạo tổ chức'} onClose={onClose} onSubmit={submit}>
      <Field id="org-name" label="Tên tổ chức">
        <input id="org-name" value={name} maxLength={150} required onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field id="org-slug" label="Slug" hint="Để trống để tự sinh từ tên.">
        <input id="org-slug" value={slug} maxLength={80} onChange={(event) => setSlug(event.target.value)} />
      </Field>
      <Field id="org-owner" label="Chủ sở hữu (OWNER)" hint="Tên đăng nhập hoặc email của tài khoản đang hoạt động. Để trống nếu chưa có OWNER.">
        <input id="org-owner" value={owner} maxLength={254} onChange={(event) => setOwner(event.target.value)} />
      </Field>
      <Field id="org-description" label="Mô tả">
        <textarea id="org-description" rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field id="org-website" label="Website">
        <input id="org-website" type="url" maxLength={500} value={website} onChange={(event) => setWebsite(event.target.value)} />
      </Field>
      {initial && (
        <Field id="org-note" label="Ghi chú xét duyệt">
          <textarea id="org-note" rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      )}
    </FormDialog>
  )
}

export function RejectDialog({ request, onClose, onDone }: { request: AdminOrganizationRequest; onClose: () => void; onDone: (updated: AdminOrganizationRequest) => void }) {
  const api = useOrganizationsApi()
  const [note, setNote] = useState('')
  return (
    <FormDialog
      title="Từ chối yêu cầu"
      submitLabel="Từ chối"
      danger
      onClose={onClose}
      onSubmit={async () => {
        const updated = await rejectOrganizationRequest(api, request.id, emptyToNull(note))
        onDone(updated)
      }}
    >
      <Field id="reject-note" label="Lý do (tùy chọn)">
        <textarea id="reject-note" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </FormDialog>
  )
}

export function OwnerDialog({ organization, onClose, onDone }: { organization: AdminOrganization; onClose: () => void; onDone: () => void }) {
  const api = useOrganizationsApi()
  const [owner, setOwner] = useState('')
  return (
    <FormDialog
      title={`Đổi OWNER — ${organization.name}`}
      submitLabel={owner.trim() ? 'Chuyển OWNER' : 'Gỡ OWNER'}
      onClose={onClose}
      onSubmit={async () => {
        await changeOrganizationOwner(api, organization.id, emptyToNull(owner))
        onDone()
      }}
    >
      <Field id="owner-identifier" label="OWNER mới" hint="Tên đăng nhập hoặc email. Để trống để gỡ OWNER; OWNER cũ trở thành ADMIN tổ chức.">
        <input id="owner-identifier" value={owner} maxLength={254} onChange={(event) => setOwner(event.target.value)} />
      </Field>
    </FormDialog>
  )
}

export function EditOrganizationDialog({ organization, onClose, onDone }: { organization: AdminOrganization; onClose: () => void; onDone: () => void }) {
  const api = useOrganizationsApi()
  const [name, setName] = useState(organization.name)
  const [slug, setSlug] = useState(organization.slug)
  const [description, setDescription] = useState(organization.description ?? '')
  const [website, setWebsite] = useState(organization.websiteUrl ?? '')
  return (
    <FormDialog
      title={`Chỉnh sửa — ${organization.name}`}
      submitLabel="Lưu thay đổi"
      onClose={onClose}
      onSubmit={async () => {
        await updateAdminOrganization(api, organization.id, {
          name: name.trim(),
          slug: slug.trim(),
          description: emptyToNull(description),
          websiteUrl: emptyToNull(website),
        })
        onDone()
      }}
    >
      <Field id="edit-org-name" label="Tên tổ chức">
        <input id="edit-org-name" value={name} maxLength={150} required onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field id="edit-org-slug" label="Slug" hint="Đổi slug sẽ thay đổi đường dẫn công khai của tổ chức.">
        <input id="edit-org-slug" value={slug} maxLength={80} required onChange={(event) => setSlug(event.target.value)} />
      </Field>
      <Field id="edit-org-description" label="Mô tả">
        <textarea id="edit-org-description" rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field id="edit-org-website" label="Website">
        <input id="edit-org-website" type="url" maxLength={500} value={website} onChange={(event) => setWebsite(event.target.value)} />
      </Field>
    </FormDialog>
  )
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return (
    <div className={styles.rowActions}>
      <button className={styles.buttonSecondary} type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Trước</button>
      <span className={styles.fieldHint}>Trang {page}/{pages} · {total} mục</span>
      <button className={styles.buttonSecondary} type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Sau</button>
    </div>
  )
}

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function OrganizationsSection({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const api = useOrganizationsApi()
  const navigate = useNavigate()
  const [result, setResult] = useState<{
    key: string
    items: AdminOrganization[]
    total: number
    error: string
  } | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrganizationStatus | ''>('')
  const [ownerTarget, setOwnerTarget] = useState<AdminOrganization | null>(null)
  const [actionError, setActionError] = useState('')
  const q = useDebounced(search)
  const queryKey = JSON.stringify([page, q, status, reloadKey])

  useEffect(() => {
    const controller = new AbortController()
    listAdminOrganizations(api, { page, pageSize: PAGE_SIZE, q: q.trim() || undefined, status: status || undefined, sort: 'newest' }, controller.signal)
      .then((response) => {
        setResult({ key: queryKey, items: response.items, total: response.total, error: '' })
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setResult({
            key: queryKey,
            items: [],
            total: 0,
            error: errorMessage(caught, 'Không thể tải danh sách tổ chức.'),
          })
        }
      })
    return () => controller.abort()
  }, [api, page, q, queryKey, status, reloadKey])

  const current = result?.key === queryKey ? result : null
  const loading = current === null
  const items = current?.items ?? []
  const total = current?.total ?? 0
  const error = current?.error ?? ''

  async function toggleArchive(organization: AdminOrganization) {
    setActionError('')
    try {
      if (organization.status === 'ACTIVE') await archiveOrganization(api, organization.id)
      else await restoreOrganization(api, organization.id)
      onChanged()
    } catch (caught) {
      setActionError(errorMessage(caught, 'Thao tác không thành công.'))
    }
  }

  return (
    <section className={styles.panel} aria-label="Danh sách tổ chức">
      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <input type="search" aria-label="Tìm tổ chức" placeholder="Tìm theo tên hoặc slug" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
        </label>
        <select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => { setStatus(event.target.value as OrganizationStatus | ''); setPage(1) }}>
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>
      </div>
      <p className={styles.fieldHint}>Tổ chức lưu trữ không nhận thành viên hay bài nộp mới.</p>
      {actionError && <p className={styles.formMessage} role="alert">{actionError}</p>}
      <div className={styles.tableWrap}>
        <table className={styles.userTable}>
          <thead>
            <tr>
              <th scope="col">Tên tổ chức</th><th scope="col">Slug</th><th scope="col">Chủ sở hữu</th>
              <th scope="col">Số thành viên</th><th scope="col">Trạng thái</th><th scope="col">Ngày tạo</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} role="status">Đang tải...</td></tr>
            ) : error ? (
              <tr><td colSpan={7} role="alert">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7}><div className={styles.emptyState}><h2>Chưa có tổ chức nào</h2></div></td></tr>
            ) : items.map((organization) => (
              <tr
                key={organization.id}
                className={styles.clickableRow}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return
                  navigate(adminOrganizationPath(organization.id))
                }}
              >
                <td data-label="Tên tổ chức">
                  <Link to={adminOrganizationPath(organization.id)}>{organization.name}</Link>
                </td>
                <td data-label="Slug">{organization.slug}</td>
                <td data-label="Chủ sở hữu">{ownerLabel(organization.owner)}</td>
                <td data-label="Số thành viên">{organization.memberCount}</td>
                <td data-label="Trạng thái">
                  <span className={`${styles.badge} ${organization.status === 'ACTIVE' ? styles.status_published : styles.status_archived}`}>
                    {organization.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ'}
                  </span>
                </td>
                <td data-label="Ngày tạo">{formatDate(organization.createdAt)}</td>
                <td data-label="Thao tác">
                  <div className={styles.rowActions}>
                    <button className={styles.buttonSecondary} type="button" disabled={organization.status === 'ARCHIVED'} onClick={() => setOwnerTarget(organization)}>Đổi OWNER</button>
                    <button className={organization.status === 'ACTIVE' ? styles.buttonDanger : styles.buttonSecondary} type="button" onClick={() => void toggleArchive(organization)}>
                      {organization.status === 'ACTIVE' ? 'Lưu trữ' : 'Khôi phục'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} onPage={setPage} />
      {ownerTarget && (
        <OwnerDialog organization={ownerTarget} onClose={() => setOwnerTarget(null)} onDone={() => { setOwnerTarget(null); onChanged() }} />
      )}
    </section>
  )
}

function RequestsSection({ reloadKey }: { reloadKey: number }) {
  const api = useOrganizationsApi()
  const navigate = useNavigate()
  const [result, setResult] = useState<{
    key: string
    items: AdminOrganizationRequest[]
    statistics: RequestStatistics
    total: number
    error: string
  } | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrganizationRequestStatus | ''>('PENDING')
  const q = useDebounced(search)
  const queryKey = JSON.stringify([page, q, status, reloadKey])

  useEffect(() => {
    const controller = new AbortController()
    listAdminRequests(api, { page, pageSize: PAGE_SIZE, q: q.trim() || undefined, status: status || undefined, sort: 'newest' }, controller.signal)
      .then((response) => {
        setResult({
          key: queryKey,
          items: response.items,
          total: response.total,
          statistics: response.statistics,
          error: '',
        })
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setResult({
            key: queryKey,
            items: [],
            total: 0,
            statistics: { total: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 },
            error: errorMessage(caught, 'Không thể tải danh sách yêu cầu.'),
          })
        }
      })
    return () => controller.abort()
  }, [api, page, q, queryKey, status, reloadKey])

  const current = result?.key === queryKey ? result : null
  const loading = current === null
  const items = current?.items ?? []
  const total = current?.total ?? 0
  const statistics = current?.statistics ?? null
  const error = current?.error ?? ''

  return (
    <section className={styles.panel} aria-label="Yêu cầu tạo tổ chức">
      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <input type="search" aria-label="Tìm yêu cầu" placeholder="Tìm theo tên hoặc đơn vị" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
        </label>
        <select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => { setStatus(event.target.value as OrganizationRequestStatus | ''); setPage(1) }}>
          <option value="">Tất cả trạng thái</option>
          {(Object.keys(REQUEST_STATUS_LABEL) as OrganizationRequestStatus[]).map((key) => (
            <option key={key} value={key}>{REQUEST_STATUS_LABEL[key]}{statistics ? ` (${statistics[key]})` : ''}</option>
          ))}
        </select>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.userTable}>
          <thead>
            <tr>
              <th scope="col">Username</th><th scope="col">Email</th>
              <th scope="col">Ngày gửi</th><th scope="col">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} role="status">Đang tải...</td></tr>
            ) : error ? (
              <tr><td colSpan={4} role="alert">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4}><div className={styles.emptyState}><h2>Chưa có yêu cầu nào</h2></div></td></tr>
            ) : items.map((request) => (
              <tr
                key={request.id}
                className={styles.clickableRow}
                role="link"
                tabIndex={0}
                aria-label={`Xem yêu cầu của ${request.requester?.username ?? 'người dùng'}`}
                onClick={() => navigate(adminOrganizationRequestPath(request.id))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(adminOrganizationRequestPath(request.id))
                  }
                }}
              >
                <td data-label="Username">{request.requester?.username ?? '—'}</td>
                <td data-label="Email">{request.requester?.email ?? '—'}</td>
                <td data-label="Ngày gửi">{formatDate(request.createdAt)}</td>
                <td data-label="Trạng thái">
                  <span className={`${styles.badge} ${REQUEST_STATUS_CLASS[request.status]}`}>{REQUEST_STATUS_LABEL[request.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} onPage={setPage} />
    </section>
  )
}

function AdminOrganizationsPage() {
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<Section>(
    searchParams.get('tab') === 'requests' ? 'requests' : 'organizations',
  )
  const [creating, setCreating] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return (
    <>
      <div className={styles.pageHeading}>
        <div><h1>Quản lý tổ chức</h1></div>
        <button className={styles.buttonPrimary} type="button" onClick={() => setCreating(true)}>
          <Building2 size={16} aria-hidden="true" /> Tạo tổ chức
        </button>
      </div>

      <div className={styles.rowActions} role="group" aria-label="Khu vực quản lý tổ chức">
        <button
          className={section === 'organizations' ? styles.buttonPrimary : styles.buttonSecondary}
          type="button"
          aria-pressed={section === 'organizations'}
          onClick={() => setSection('organizations')}
        >
          Danh sách tổ chức
        </button>
        <button
          className={section === 'requests' ? styles.buttonPrimary : styles.buttonSecondary}
          type="button"
          aria-pressed={section === 'requests'}
          onClick={() => setSection('requests')}
        >
          Yêu cầu tạo tổ chức
        </button>
      </div>

      {section === 'organizations'
        ? <OrganizationsSection reloadKey={reloadKey} onChanged={reload} />
        : <RequestsSection reloadKey={reloadKey} />}
      {creating && <OrganizationDialog onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload() }} />}
    </>
  )
}

export default AdminOrganizationsPage
