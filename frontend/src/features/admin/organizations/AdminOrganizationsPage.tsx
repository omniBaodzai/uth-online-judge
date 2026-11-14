import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Archive, Building2, CircleCheck, ClipboardList, Plus, Search, type LucideIcon } from 'lucide-react'
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
} from '../../organizations/organizations-api'
import { useOrganizationsApi } from '../../organizations/useOrganizationsApi'
import SubmissionPagination from '../../submissions/components/SubmissionPagination'
import { submissionPageSizes } from '../../submissions/data'
import { adminOrganizationPath } from './organization-detail-links'
import { adminOrganizationRequestPath } from './organization-request-links'
import adminStyles from '../admin.module.css'
import styles from './AdminOrganizationsPage.module.css'

type Section = 'organizations' | 'requests'
type OrganizationStats = { total: number; active: number; archived: number; pendingRequests: number }
type MetricCardProps = {
  label: string
  value: number | undefined
  loading: boolean
  tone: 'teal' | 'green' | 'slate' | 'amber'
  icon: LucideIcon
}

const PAGE_SIZES = submissionPageSizes
const DEFAULT_PAGE_SIZE = 10
const REQUEST_STATUS_LABEL: Record<OrganizationRequestStatus, string> = {
  PENDING: 'Chờ xử lý',
  APPROVED: 'Chấp thuận',
  REJECTED: 'Từ chối',
}
const REQUEST_STATUS_CLASS: Record<OrganizationRequestStatus, string> = {
  PENDING: adminStyles.status_draft,
  APPROVED: adminStyles.status_published,
  REJECTED: adminStyles.status_inactive,
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('vi-VN')
const ownerLabel = (owner: AdminOrganization['owner']) =>
  owner ? owner.fullName || owner.username || owner.id : 'Chưa có OWNER'

function MetricCard({ label, value, loading, tone, icon: Icon }: MetricCardProps) {
  return (
    <article className={`${styles.metricCard} ${styles[`metric_${tone}`]}`}>
      <span className={styles.metricIcon}><Icon size={20} aria-hidden="true" /></span>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue} aria-live="polite">{loading ? '…' : value?.toLocaleString('vi-VN') ?? '—'}</strong>
    </article>
  )
}

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
    <div className={adminStyles.dialogBackdrop} onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section
        className={adminStyles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => event.key === 'Escape' && !busy && onClose()}
      >
        <h2>{title}</h2>
        <form className={adminStyles.formStack} onSubmit={handleSubmit}>
          {children}
          {error && <p className={adminStyles.formMessage} role="alert">{error}</p>}
          <div className={adminStyles.dialogActions}>
            <button className={adminStyles.buttonSecondary} type="button" disabled={busy} onClick={onClose}>Hủy</button>
            <button className={danger ? adminStyles.buttonDanger : adminStyles.buttonPrimary} type="submit" disabled={busy}>
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
    <div className={adminStyles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className={adminStyles.fieldHint}>{hint}</p>}
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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrganizationStatus | ''>('')
  const [ownerTarget, setOwnerTarget] = useState<AdminOrganization | null>(null)
  const [actionError, setActionError] = useState('')
  const q = useDebounced(search)
  const queryKey = JSON.stringify([page, pageSize, q, status, reloadKey])

  useEffect(() => {
    const controller = new AbortController()
    listAdminOrganizations(api, { page, pageSize, q: q.trim() || undefined, status: status || undefined, sort: 'newest' }, controller.signal)
      .then((response) => {
        const lastPage = Math.max(1, Math.ceil(response.total / response.pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
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
  }, [api, page, pageSize, q, queryKey, status, reloadKey])

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
    <div className={styles.sectionContent}>
      <div className={styles.toolbar}>
        <label className={`${adminStyles.searchField} ${styles.searchField}`}>
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Tìm tổ chức" placeholder="Tìm theo tên hoặc slug" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
        </label>
        <select className={styles.filterSelect} aria-label="Lọc theo trạng thái tổ chức" value={status} onChange={(event) => { setStatus(event.target.value as OrganizationStatus | ''); setPage(1) }}>
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>
      </div>
      {/* <p className={`${adminStyles.fieldHint} ${styles.helperText}`}>Tổ chức lưu trữ không nhận thành viên hay bài nộp mới.</p> */}
      {actionError && <p className={adminStyles.formMessage} role="alert">{actionError}</p>}
      {total > 0 && (
        <div className={styles.pagination}>
          <SubmissionPagination
            currentPage={page}
            pageSize={pageSize}
            totalItems={total}
            pageSizes={PAGE_SIZES}
            label="tổ chức"
            summaryLabel="tổ chức"
            showPageSize={false}
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPage(1); setPageSize(size) }}
          />
        </div>
      )}
      <div className={`${adminStyles.tableWrap} ${styles.tableWrap}`}>
        <table className={`${adminStyles.userTable} ${styles.table}`}>
          <thead>
            <tr>
              <th scope="col">TÊN TỔ CHỨC</th><th scope="col">SLUG</th><th scope="col">CHỦ SỞ HỮU</th>
              <th scope="col">SỐ THÀNH VIÊN</th><th scope="col">TRẠNG THÁI</th><th scope="col">NGÀY TẠO</th>
              <th scope="col">THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} role="status">Đang tải...</td></tr>
            ) : error ? (
              <tr><td colSpan={7} role="alert">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7}><div className={adminStyles.emptyState}><h2>Chưa có tổ chức nào</h2></div></td></tr>
            ) : items.map((organization) => (
              <tr
                key={organization.id}
                className={`${adminStyles.clickableRow} ${styles.clickableRow}`}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return
                  navigate(adminOrganizationPath(organization.id))
                }}
              >
                <td data-label="Tên tổ chức" className={styles.organizationName}>
                  <Link to={adminOrganizationPath(organization.id)}>{organization.name}</Link>
                </td>
                <td data-label="Slug"><code className={styles.slug}>{organization.slug}</code></td>
                <td data-label="Chủ sở hữu">{ownerLabel(organization.owner)}</td>
                <td data-label="Số thành viên">{organization.memberCount}</td>
                <td data-label="Trạng thái">
                  <span className={`${adminStyles.badge} ${organization.status === 'ACTIVE' ? adminStyles.status_published : adminStyles.status_archived}`}>
                    {organization.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ'}
                  </span>
                </td>
                <td data-label="Ngày tạo">{formatDate(organization.createdAt)}</td>
                <td data-label="Thao tác">
                  <div className={`${adminStyles.rowActions} ${styles.rowActions}`}>
                    <button className={adminStyles.buttonSecondary} type="button" disabled={organization.status === 'ARCHIVED'} onClick={() => setOwnerTarget(organization)}>Đổi OWNER</button>
                    <button className={organization.status === 'ACTIVE' ? adminStyles.buttonDanger : adminStyles.buttonSecondary} type="button" onClick={() => void toggleArchive(organization)}>
                      {organization.status === 'ACTIVE' ? 'Lưu trữ' : 'Khôi phục'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 0 && (
        <div className={styles.pagination}>
          <SubmissionPagination
            currentPage={page}
            pageSize={pageSize}
            totalItems={total}
            pageSizes={PAGE_SIZES}
            label="tổ chức"
            summaryLabel="tổ chức"
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPage(1); setPageSize(size) }}
          />
        </div>
      )}
      {ownerTarget && (
        <OwnerDialog organization={ownerTarget} onClose={() => setOwnerTarget(null)} onDone={() => { setOwnerTarget(null); onChanged() }} />
      )}
    </div>
  )
}

function RequestsSection({ reloadKey }: { reloadKey: number }) {
  const api = useOrganizationsApi()
  const navigate = useNavigate()
  const [result, setResult] = useState<{
    key: string
    items: AdminOrganizationRequest[]
    total: number
    error: string
  } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrganizationRequestStatus | ''>('PENDING')
  const q = useDebounced(search)
  const queryKey = JSON.stringify([page, pageSize, q, status, reloadKey])

  useEffect(() => {
    const controller = new AbortController()
    listAdminRequests(api, { page, pageSize, q: q.trim() || undefined, status: status || undefined, sort: 'newest' }, controller.signal)
      .then((response) => {
        const lastPage = Math.max(1, Math.ceil(response.total / response.pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setResult({
          key: queryKey,
          items: response.items,
          total: response.total,
          error: '',
        })
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setResult({
            key: queryKey,
            items: [],
            total: 0,
            error: errorMessage(caught, 'Không thể tải danh sách yêu cầu.'),
          })
        }
      })
    return () => controller.abort()
  }, [api, page, pageSize, q, queryKey, status, reloadKey])

  const current = result?.key === queryKey ? result : null
  const loading = current === null
  const items = current?.items ?? []
  const total = current?.total ?? 0
  const error = current?.error ?? ''

  return (
    <div className={styles.sectionContent}>
      <div className={styles.toolbar}>
        <label className={`${adminStyles.searchField} ${styles.searchField}`}>
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Tìm yêu cầu" placeholder="Tìm theo tên hoặc đơn vị" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
        </label>
        <select className={styles.filterSelect} aria-label="Lọc theo trạng thái yêu cầu" value={status} onChange={(event) => { setStatus(event.target.value as OrganizationRequestStatus | ''); setPage(1) }}>
          <option value="">Tất cả trạng thái</option>
          {(Object.keys(REQUEST_STATUS_LABEL) as OrganizationRequestStatus[]).map((key) => (
            <option key={key} value={key}>{REQUEST_STATUS_LABEL[key]}</option>
          ))}
        </select>
      </div>
      {total > 0 && (
        <div className={styles.pagination}>
          <SubmissionPagination
            currentPage={page}
            pageSize={pageSize}
            totalItems={total}
            pageSizes={PAGE_SIZES}
            label="yêu cầu"
            summaryLabel="yêu cầu"
            showPageSize={false}
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPage(1); setPageSize(size) }}
          />
        </div>
      )}
      <div className={`${adminStyles.tableWrap} ${styles.tableWrap}`}>
        <table className={`${adminStyles.userTable} ${styles.table}`}>
          <thead>
            <tr>
              <th scope="col">USERNAME</th><th scope="col">EMAIL</th>
              <th scope="col">NGÀY GỬI</th><th scope="col">TRẠNG THÁI</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} role="status">Đang tải...</td></tr>
            ) : error ? (
              <tr><td colSpan={4} role="alert">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4}><div className={adminStyles.emptyState}><h2>Chưa có yêu cầu nào</h2></div></td></tr>
            ) : items.map((request) => (
              <tr
                key={request.id}
                className={`${adminStyles.clickableRow} ${styles.clickableRow}`}
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
                  <span className={`${adminStyles.badge} ${REQUEST_STATUS_CLASS[request.status]}`}>{REQUEST_STATUS_LABEL[request.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 0 && (
        <div className={styles.pagination}>
          <SubmissionPagination
            currentPage={page}
            pageSize={pageSize}
            totalItems={total}
            pageSizes={PAGE_SIZES}
            label="yêu cầu"
            summaryLabel="yêu cầu"
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPage(1); setPageSize(size) }}
          />
        </div>
      )}
    </div>
  )
}

function AdminOrganizationsPage() {
  const api = useOrganizationsApi()
  const [searchParams] = useSearchParams()
  const initialSection: Section = searchParams.get('tab') === 'requests' ? 'requests' : 'organizations'
  const [section, setSection] = useState<Section>(initialSection)
  const [visitedSections, setVisitedSections] = useState<Set<Section>>(() => new Set([initialSection]))
  const [statsResult, setStatsResult] = useState<{
    key: string
    data: OrganizationStats | null
    error: string
  } | null>(null)
  const [creating, setCreating] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((key) => key + 1), [])
  const [statsRetryKey, setStatsRetryKey] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const statsKey = JSON.stringify([reloadKey, statsRetryKey])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      listAdminOrganizations(api, { page: 1, pageSize: 1, sort: 'newest' }, controller.signal),
      listAdminOrganizations(api, { page: 1, pageSize: 1, status: 'ACTIVE', sort: 'newest' }, controller.signal),
      listAdminOrganizations(api, { page: 1, pageSize: 1, status: 'ARCHIVED', sort: 'newest' }, controller.signal),
      listAdminRequests(api, { page: 1, pageSize: 1, sort: 'newest' }, controller.signal),
    ])
      .then(([allOrganizations, activeOrganizations, archivedOrganizations, requests]) => {
        setStatsResult({
          key: statsKey,
          data: {
            total: allOrganizations.total,
            active: activeOrganizations.total,
            archived: archivedOrganizations.total,
            pendingRequests: requests.statistics.PENDING,
          },
          error: '',
        })
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setStatsResult({ key: statsKey, data: null, error: errorMessage(caught, 'Không thể tải thống kê tổ chức.') })
        }
      })
    return () => controller.abort()
  }, [api, reloadKey, statsRetryKey, statsKey])

  const currentStats = statsResult?.key === statsKey ? statsResult : null
  const stats = currentStats?.data ?? null
  const statsLoading = currentStats === null
  const statsError = currentStats?.error ?? ''

  function selectSection(next: Section) {
    setSection(next)
    setVisitedSections((previous) => new Set(previous).add(next))
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + 2) % 2
    const next = nextIndex === 0 ? 'organizations' : 'requests'
    selectSection(next)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div className={styles.page}>
      <section className={styles.metrics} aria-label="Thống kê tổ chức">
        <MetricCard label="Tổng tổ chức" value={stats?.total} loading={statsLoading} tone="teal" icon={Building2} />
        <MetricCard label="Đang hoạt động" value={stats?.active} loading={statsLoading} tone="green" icon={CircleCheck} />
        <MetricCard label="Đã lưu trữ" value={stats?.archived} loading={statsLoading} tone="slate" icon={Archive} />
        <MetricCard label="Yêu cầu chờ duyệt" value={stats?.pendingRequests} loading={statsLoading} tone="amber" icon={ClipboardList} />
      </section>
      {statsError && (
        <div className={styles.statsError} role="alert">
          <span>{statsError}</span>
          <button type="button" className={adminStyles.buttonSecondary} onClick={() => setStatsRetryKey((key) => key + 1)}>Thử lại</button>
        </div>
      )}
      <div className={styles.createAction}>
        <button className={`${adminStyles.buttonPrimary} ${styles.createButton}`} type="button" onClick={() => setCreating(true)}>
          <Plus size={17} aria-hidden="true" /> Tạo tổ chức
        </button>
      </div>

      <section className={`${adminStyles.panel} ${styles.managementPanel}`} aria-label="Quản lý tổ chức">
      <div className={styles.tabs} role="tablist" aria-label="Khu vực quản lý tổ chức">
        <button
          ref={(element) => { tabRefs.current[0] = element }}
          className={section === 'organizations' ? styles.activeTab : styles.tab}
          type="button"
          role="tab"
          id="organizations-tab"
          aria-selected={section === 'organizations'}
          aria-controls="organizations-panel"
          tabIndex={section === 'organizations' ? 0 : -1}
          onClick={() => selectSection('organizations')}
          onKeyDown={(event) => handleTabKeyDown(event, 0)}
        >
          Danh sách tổ chức
        </button>
        <button
          ref={(element) => { tabRefs.current[1] = element }}
          className={section === 'requests' ? styles.activeTab : styles.tab}
          type="button"
          role="tab"
          id="requests-tab"
          aria-selected={section === 'requests'}
          aria-controls="requests-panel"
          tabIndex={section === 'requests' ? 0 : -1}
          onClick={() => selectSection('requests')}
          onKeyDown={(event) => handleTabKeyDown(event, 1)}
        >
          Yêu cầu tạo tổ chức
        </button>
      </div>
      {visitedSections.has('organizations') && (
        <div id="organizations-panel" className={styles.tabPanel} role="tabpanel" aria-labelledby="organizations-tab" hidden={section !== 'organizations'}>
          <OrganizationsSection reloadKey={reloadKey} onChanged={reload} />
        </div>
      )}
      {visitedSections.has('requests') && (
        <div id="requests-panel" className={styles.tabPanel} role="tabpanel" aria-labelledby="requests-tab" hidden={section !== 'requests'}>
          <RequestsSection reloadKey={reloadKey} />
        </div>
      )}
      </section>
      {creating && <OrganizationDialog onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload() }} />}
    </div>
  )
}

export default AdminOrganizationsPage
