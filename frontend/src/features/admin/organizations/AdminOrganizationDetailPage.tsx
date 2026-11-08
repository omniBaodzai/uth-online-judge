import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  archiveOrganization,
  errorMessage,
  getAdminOrganization,
  restoreOrganization,
  type AdminOrganizationDetail,
  type OrganizationVisibility,
} from '../../organizations/organizations-api'
import MemberManager from '../../organizations/components/MemberManager'
import OrganizationContentPanel from '../../organizations/components/OrganizationContentPanel'
import { useOrganizationsApi } from '../../organizations/useOrganizationsApi'
import { EditOrganizationDialog, OwnerDialog } from './AdminOrganizationsPage'
import { organizationDetailLinks, organizationDetailLoadError } from './organization-detail-links'
import styles from '../admin.module.css'

const VISIBILITY_LABEL: Record<OrganizationVisibility, string> = { PUBLIC: 'Công khai', PRIVATE: 'Riêng tư' }

const dateTime = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '—')

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  )
}

type Loaded = { id: string; loadKey: number; organization: AdminOrganizationDetail | null; error: unknown }

function AdminOrganizationDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const api = useOrganizationsApi()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [dialog, setDialog] = useState<'edit' | 'owner' | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [copyState, setCopyState] = useState<{ key: string; message: string; error: boolean } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getAdminOrganization(api, id, controller.signal)
      .then((organization) => setLoaded({ id, loadKey: reloadKey, organization, error: null }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoaded({ id, loadKey: reloadKey, organization: null, error })
      })
    return () => controller.abort()
  }, [api, id, reloadKey])

  const current = loaded?.id === id && loaded.loadKey === reloadKey ? loaded : null
  const organization = current?.organization ?? null
  const backToList = '/admin/organizations'
  const refresh = () => setReloadKey((key) => key + 1)

  async function copyUrl(key: string, path: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString())
      setCopyState({ key, message: 'Đã sao chép đường dẫn.', error: false })
    } catch {
      setCopyState({ key, message: 'Không thể sao chép. Hãy chọn và sao chép liên kết thủ công.', error: true })
    }
  }

  async function toggleArchive(target: AdminOrganizationDetail) {
    if (busy) return
    setBusy(true)
    setActionError('')
    try {
      if (target.status === 'ACTIVE') await archiveOrganization(api, target.id)
      else await restoreOrganization(api, target.id)
      refresh()
    } catch (caught) {
      setActionError(errorMessage(caught, 'Thao tác không thành công.'))
    } finally {
      setBusy(false)
    }
  }

  if (current === null) {
    return <section className={styles.panel} role="status">Đang tải chi tiết tổ chức...</section>
  }

  if (!organization) {
    const loadError = organizationDetailLoadError(current.error)
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
            <button className={styles.buttonPrimary} type="button" onClick={refresh}>Thử lại</button>
          )}
        </div>
      </section>
    )
  }

  const archived = organization.status === 'ARCHIVED'
  const links = organizationDetailLinks(organization)
  const owner = organization.owner
  const urlRows = [
    ['public', 'Trang tổ chức', links.public],
    ['manage', 'Trang quản lý OWNER', links.manage],
  ] as const

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <Link className={styles.backLink} to={backToList}>
            <ArrowLeft size={16} aria-hidden="true" /> Danh sách tổ chức
          </Link>
          <h1>{organization.name}</h1>
          <p>Chi tiết tổ chức dành cho Quản trị viên hệ thống</p>
        </div>
        <span className={`${styles.badge} ${archived ? styles.status_archived : styles.status_published}`}>
          {archived ? 'Đã lưu trữ' : 'Đang hoạt động'}
        </span>
      </div>

      <div className={styles.rowActions}>
        <button className={styles.buttonSecondary} type="button" disabled={archived || busy} onClick={() => setDialog('edit')}>Chỉnh sửa</button>
        <button className={styles.buttonSecondary} type="button" disabled={archived || busy} onClick={() => setDialog('owner')}>Đổi / gỡ OWNER</button>
        <button
          className={archived ? styles.buttonPrimary : styles.buttonDanger}
          type="button"
          disabled={busy}
          onClick={() => void toggleArchive(organization)}
        >
          {busy ? 'Đang xử lý...' : archived ? 'Khôi phục' : 'Lưu trữ'}
        </button>
      </div>
      {archived && (
        <p className={styles.fieldHint} role="note">
          Tổ chức đã được lưu trữ: chỉ có thể khôi phục hoặc xem lịch sử. Hãy khôi phục trước khi chỉnh sửa.
        </p>
      )}
      {actionError && <p className={styles.formMessage} role="alert">{actionError}</p>}

      <section className={styles.panel} aria-labelledby="org-info-heading">
        <h2 id="org-info-heading">Thông tin</h2>
        <dl className={styles.detailList}>
          <DetailField label="Tên tổ chức">{organization.name}</DetailField>
          <DetailField label="Slug">{organization.slug}</DetailField>
          <DetailField label="Mô tả">{organization.description}</DetailField>
          <DetailField label="Website">
            {organization.websiteUrl && (
              <a href={organization.websiteUrl} target="_blank" rel="noreferrer noopener">{organization.websiteUrl}</a>
            )}
          </DetailField>
          <DetailField label="Ngày tạo">{dateTime(organization.createdAt)}</DetailField>
          <DetailField label="Cập nhật lần cuối">{dateTime(organization.updatedAt)}</DetailField>
          <DetailField label="Số thành viên">{organization.memberCount}</DetailField>
        </dl>
      </section>

      <section className={styles.panel} aria-labelledby="org-owner-heading">
        <h2 id="org-owner-heading">Chủ sở hữu (OWNER)</h2>
        {owner ? (
          <dl className={styles.detailList}>
            <DetailField label="Username">{owner.username}</DetailField>
            <DetailField label="Họ và tên">{owner.fullName}</DetailField>
          </dl>
        ) : (
          <p className={styles.fieldHint}>Chưa có OWNER. Chỉ Quản trị viên hệ thống đang quản trị tổ chức này.</p>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="org-visibility-heading">
        <h2 id="org-visibility-heading">Hiển thị nội dung</h2>
        <dl className={styles.detailList}>
          <DetailField label="Problems">{VISIBILITY_LABEL[organization.problemsVisibility]}</DetailField>
          <DetailField label="Contests">{VISIBILITY_LABEL[organization.contestsVisibility]}</DetailField>
          <DetailField label="Submissions">{VISIBILITY_LABEL[organization.submissionsVisibility]}</DetailField>
        </dl>
      </section>

      <section className={styles.panel} aria-labelledby="org-links-heading">
        <h2 id="org-links-heading">Đường dẫn</h2>
        <div className={styles.requestLinks}>
          {urlRows.map(([key, label, path]) => (
            <div className={styles.requestLinkRow} key={key}>
              <Link to={path}><ExternalLink size={15} aria-hidden="true" />{label}: {new URL(path, window.location.origin).toString()}</Link>
              <button className={styles.buttonSecondary} type="button" onClick={() => void copyUrl(key, path)}>
                <Copy size={15} aria-hidden="true" />
                {copyState?.key === key && !copyState.error ? 'Đã sao chép' : 'Sao chép'}
              </button>
            </div>
          ))}
          {links.request && (
            <div className={styles.requestLinkRow}>
              <Link to={links.request}><ExternalLink size={15} aria-hidden="true" />Hồ sơ yêu cầu tạo tổ chức</Link>
            </div>
          )}
          {copyState && (
            <p className={styles.fieldHint} role={copyState.error ? 'alert' : 'status'}>{copyState.message}</p>
          )}
        </div>
      </section>

      {archived && (
        <section className={styles.panel} aria-labelledby="org-history-heading">
          <h2 id="org-history-heading">Lịch sử lưu trữ</h2>
          <dl className={styles.detailList}>
            <DetailField label="Thời gian lưu trữ">{dateTime(organization.archivedAt)}</DetailField>
            <DetailField label="Người lưu trữ">
              {organization.archivedBy?.username ?? organization.archivedBy?.fullName}
            </DetailField>
          </dl>
        </section>
      )}

      <MemberManager
        slug={organization.slug}
        archived={archived}
        viewer={{ id: '', isSystemAdmin: true, role: null }}
        onChanged={() => {
          void getAdminOrganization(api, id).then((fresh) => setLoaded({ id, loadKey: reloadKey, organization: fresh, error: null })).catch(() => undefined)
        }}
      />

      <OrganizationContentPanel
        slug={organization.slug}
        section="problems"
        canManage={!archived}
        archived={archived}
      />
      <OrganizationContentPanel
        slug={organization.slug}
        section="contests"
        canManage={!archived}
        archived={archived}
      />

      {dialog === 'edit' && (
        <EditOrganizationDialog
          organization={organization}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); refresh() }}
        />
      )}
      {dialog === 'owner' && (
        <OwnerDialog
          organization={organization}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); refresh() }}
        />
      )}
    </>
  )
}

export default AdminOrganizationDetailPage
