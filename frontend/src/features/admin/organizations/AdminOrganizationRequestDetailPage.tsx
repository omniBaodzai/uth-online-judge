import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getAdminOrganizationRequest,
  type AdminOrganizationRequest,
  type OrganizationRequestStatus,
} from '../../organizations/organizations-api'
import { useOrganizationsApi } from '../../organizations/useOrganizationsApi'
import { OrganizationDialog, RejectDialog } from './AdminOrganizationsPage'
import { organizationRequestLinks, organizationRequestLoadError } from './organization-request-links'
import styles from '../admin.module.css'

const statusLabel: Record<OrganizationRequestStatus, string> = {
  PENDING: 'Chờ xử lý',
  APPROVED: 'Đã chấp thuận',
  REJECTED: 'Đã từ chối',
}

const statusClass: Record<OrganizationRequestStatus, string> = {
  PENDING: styles.status_draft,
  APPROVED: styles.status_published,
  REJECTED: styles.status_inactive,
}

const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : '—'

function RequestDetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  )
}

function AdminOrganizationRequestDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const api = useOrganizationsApi()
  const [loaded, setLoaded] = useState<{
    id: string
    loadKey: number
    request: AdminOrganizationRequest | null
    error: unknown
  } | null>(null)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [copyState, setCopyState] = useState<{ key: string; message: string; error: boolean } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void getAdminOrganizationRequest(api, id, controller.signal)
      .then((request) => setLoaded({ id, loadKey: reloadKey, request, error: null }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoaded({ id, loadKey: reloadKey, request: null, error })
      })
    return () => controller.abort()
  }, [api, id, reloadKey])

  const current = loaded?.id === id && loaded.loadKey === reloadKey ? loaded : null
  const request = current?.request ?? null
  const error = current?.error ?? null
  const loading = current === null
  const backToList = '/admin/organizations?tab=requests'

  async function copyUrl(key: string, path: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString())
      setCopyState({ key, message: 'Đã sao chép đường dẫn.', error: false })
    } catch {
      setCopyState({ key, message: 'Không thể sao chép. Hãy chọn và sao chép liên kết thủ công.', error: true })
    }
  }

  function updateRequest(updated: AdminOrganizationRequest) {
    setLoaded({ id, loadKey: reloadKey, request: updated, error: null })
    setAction(null)
  }

  if (loading) {
    return <section className={styles.panel} role="status">Đang tải chi tiết yêu cầu...</section>
  }

  if (!request) {
    const loadError = organizationRequestLoadError(error)
    return (
      <section className={styles.panel}>
        <div className={styles.pageHeading}>
          <div><h1>{loadError.title}</h1><p>{loadError.message}</p></div>
        </div>
        <div className={styles.rowActions}>
          <button className={styles.buttonSecondary} type="button" onClick={() => navigate(backToList)}>
            <ArrowLeft size={16} aria-hidden="true" /> Quay lại danh sách
          </button>
          {loadError.canRetry && (
            <button className={styles.buttonPrimary} type="button" onClick={() => setReloadKey((key) => key + 1)}>Thử lại</button>
          )}
        </div>
      </section>
    )
  }

  const organization = request.createdOrganizationDetails
  const links = organizationRequestLinks(request)
  const requesterName = request.requester?.username ?? 'Tài khoản không còn tồn tại'
  const reviewerName = request.reviewer?.username ?? '—'

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <Link className={styles.backLink} to={backToList}>
            <ArrowLeft size={16} aria-hidden="true" /> Danh sách yêu cầu
          </Link>
          <h1>Chi tiết yêu cầu tạo tổ chức</h1>
          <p>Yêu cầu từ {requesterName}</p>
        </div>
        <span className={`${styles.badge} ${statusClass[request.status]}`}>{statusLabel[request.status]}</span>
      </div>

      <section className={styles.panel} aria-labelledby="request-sender-heading">
        <h2 id="request-sender-heading">Thông tin người gửi</h2>
        <dl className={styles.detailList}>
          <RequestDetailField label="Username">{request.requester?.username ?? 'Tài khoản không còn tồn tại'}</RequestDetailField>
          <RequestDetailField label="Email">{request.requester?.email}</RequestDetailField>
          <RequestDetailField label="Họ và tên">{request.fullName}</RequestDetailField>
          <RequestDetailField label="Đơn vị công tác">{request.workplace}</RequestDetailField>
          <RequestDetailField label="Chức vụ">{request.position}</RequestDetailField>
          <RequestDetailField label="Số điện thoại">{request.phoneNumber}</RequestDetailField>
          <RequestDetailField label="Mong muốn">{request.motivation}</RequestDetailField>
          <RequestDetailField label="Ngày gửi">{dateTime(request.createdAt)}</RequestDetailField>
        </dl>
      </section>

      <section className={styles.panel} aria-labelledby="request-review-heading">
        <h2 id="request-review-heading">Xét duyệt</h2>
        <dl className={styles.detailList}>
          <RequestDetailField label="Trạng thái">{statusLabel[request.status]}</RequestDetailField>
          <RequestDetailField label="Người xét duyệt">{reviewerName}</RequestDetailField>
          <RequestDetailField label="Thời gian xét duyệt">{dateTime(request.reviewedAt)}</RequestDetailField>
          <RequestDetailField label={request.status === 'REJECTED' ? 'Lý do từ chối' : 'Ghi chú xét duyệt'}>
            {request.reviewNote}
          </RequestDetailField>
        </dl>
      </section>

      {request.status === 'APPROVED' && (
        <section className={styles.panel} aria-labelledby="created-organization-heading">
          <h2 id="created-organization-heading">Tổ chức đã tạo</h2>
          {organization ? (
            <>
              <dl className={styles.detailList}>
                <RequestDetailField label="Tên tổ chức">{organization.name}</RequestDetailField>
                <RequestDetailField label="Slug">{organization.slug}</RequestDetailField>
                <RequestDetailField label="OWNER">
                  {organization.owner?.username ?? organization.owner?.fullName ?? 'Chưa có OWNER'}
                </RequestDetailField>
                <RequestDetailField label="Trạng thái">
                  <span className={`${styles.badge} ${organization.status === 'ACTIVE' ? styles.status_published : styles.status_archived}`}>
                    {organization.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ'}
                  </span>
                </RequestDetailField>
              </dl>
              {links && (
                <div className={styles.requestLinks}>
                  {([
                    ['public', 'Trang chi tiết tổ chức', links.public],
                    ['manage', 'Trang quản lý tổ chức', links.manage],
                    ['admin', 'Quản lý Admin', links.admin],
                  ] as const).map(([key, label, path]) => (
                    <div className={styles.requestLinkRow} key={key}>
                      <Link to={path}><ExternalLink size={15} aria-hidden="true" />{label}: {new URL(path, window.location.origin).toString()}</Link>
                      <button className={styles.buttonSecondary} type="button" onClick={() => void copyUrl(key, path)}>
                        <Copy size={15} aria-hidden="true" />
                        {copyState?.key === key && !copyState.error ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                    </div>
                  ))}
                  {copyState && (
                    <p className={styles.fieldHint} role={copyState.error ? 'alert' : 'status'}>{copyState.message}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className={styles.fieldHint} role="alert">Máy chủ chưa trả về thông tin tổ chức đã tạo.</p>
          )}
        </section>
      )}

      {request.status === 'PENDING' && (
        <div className={styles.rowActions}>
          <button className={styles.buttonPrimary} type="button" onClick={() => setAction('approve')}>Duyệt yêu cầu</button>
          <button className={styles.buttonDanger} type="button" onClick={() => setAction('reject')}>Từ chối yêu cầu</button>
        </div>
      )}

      {action === 'approve' && (
        <OrganizationDialog
          initial={request}
          onClose={() => setAction(null)}
          onDone={(updated) => {
            if (updated) updateRequest(updated)
          }}
        />
      )}
      {action === 'reject' && (
        <RejectDialog request={request} onClose={() => setAction(null)} onDone={updateRequest} />
      )}
    </>
  )
}

export default AdminOrganizationRequestDetailPage
