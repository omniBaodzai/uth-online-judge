import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Archive, ArrowLeft, Copy, ExternalLink, Pencil, RotateCcw, UserRoundCog } from 'lucide-react'
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
import styles from './AdminOrganizationDetailPage.module.css'

const VISIBILITY_LABEL: Record<OrganizationVisibility, string> = { PUBLIC: 'Công khai', PRIVATE: 'Riêng tư' }

const dateTime = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : '—')

function DetailField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>{children ?? '—'}</dd>
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
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getAdminOrganization(api, id, controller.signal)
      .then((organization) => setLoaded({ id, loadKey: reloadKey, organization, error: null }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoaded({ id, loadKey: reloadKey, organization: null, error })
      })
    return () => controller.abort()
  }, [api, id, reloadKey])

  useEffect(() => {
    if (!dialog) return
    document.querySelector<HTMLElement>(
      '[role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select, [role="dialog"] button',
    )?.focus()
    return () => {
      if (dialogTriggerRef.current?.isConnected) dialogTriggerRef.current.focus()
    }
  }, [dialog])

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
    return <section className={styles.stateCard} role="status">Đang tải chi tiết tổ chức...</section>
  }

  if (!organization) {
    const loadError = organizationDetailLoadError(current.error)
    return (
      <section className={styles.stateCard}>
        <div className={styles.stateHeading}>
          <div><h1>{loadError.title}</h1><p>{loadError.message}</p></div>
        </div>
        <div className={styles.actions}>
          <button className={`${styles.actionButton} ${styles.secondaryAction}`} type="button" onClick={() => navigate(backToList)}>
            <ArrowLeft size={16} aria-hidden="true" /> Quay lại danh sách
          </button>
          {loadError.canRetry && (
            <button className={`${styles.actionButton} ${styles.primaryAction}`} type="button" onClick={refresh}>Thử lại</button>
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
    <div className={styles.detailPage}>
      <div className={styles.actions} role="group" aria-label="Thao tác tổ chức">
        <button
          className={`${styles.actionButton} ${styles.secondaryAction}`}
          type="button"
          disabled={archived || busy}
          onClick={(event) => { dialogTriggerRef.current = event.currentTarget; setDialog('edit') }}
        >
          <Pencil size={16} aria-hidden="true" /> Chỉnh sửa
        </button>
        <button
          className={`${styles.actionButton} ${styles.secondaryAction}`}
          type="button"
          disabled={archived || busy}
          onClick={(event) => { dialogTriggerRef.current = event.currentTarget; setDialog('owner') }}
        >
          <UserRoundCog size={16} aria-hidden="true" /> Đổi / gỡ OWNER
        </button>
        <button
          className={`${styles.actionButton} ${archived ? styles.primaryAction : styles.dangerAction}`}
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void toggleArchive(organization)}
        >
          {busy ? 'Đang xử lý...' : archived
            ? <><RotateCcw size={16} aria-hidden="true" /> Khôi phục</>
            : <><Archive size={16} aria-hidden="true" /> Lưu trữ</>}
        </button>
      </div>
      {archived && (
        <p className={styles.archivedNotice} role="note">
          Tổ chức đã được lưu trữ: chỉ có thể khôi phục hoặc xem lịch sử. Hãy khôi phục trước khi chỉnh sửa.
        </p>
      )}
      {actionError && <p className={styles.errorMessage} role="alert">{actionError}</p>}

      <div className={styles.overviewGrid}>
        <section className={`${styles.card} ${styles.organizationCard}`} aria-labelledby="org-info-heading">
        <h1 className={styles.cardTitle} id="org-info-heading">Thông tin tổ chức</h1>
        <dl className={`${styles.detailList} ${styles.infoGrid}`}>
          <DetailField label="Tên tổ chức">{organization.name}</DetailField>
          <DetailField label="Slug">{organization.slug}</DetailField>
          <DetailField label="Mô tả" className={`${styles.wideField} ${styles.descriptionField}`}>{organization.description}</DetailField>
          <DetailField label="Website">
            {organization.websiteUrl ? (
              <a href={organization.websiteUrl} target="_blank" rel="noreferrer noopener">{organization.websiteUrl}</a>
            ) : null}
          </DetailField>
          <DetailField label="Ngày tạo">{dateTime(organization.createdAt)}</DetailField>
          <DetailField label="Cập nhật lần cuối">{dateTime(organization.updatedAt)}</DetailField>
          <DetailField label="Số thành viên">{organization.memberCount}</DetailField>
        </dl>
        </section>

        <section className={`${styles.card} ${styles.ownerCard}`} aria-labelledby="org-owner-heading">
        <h2 className={styles.cardTitle} id="org-owner-heading">Chủ sở hữu (OWNER)</h2>
        {owner ? (
          <dl className={`${styles.detailList} ${styles.ownerList}`}>
            <DetailField label="Username">{owner.username}</DetailField>
            <DetailField label="Họ và tên">{owner.fullName}</DetailField>
          </dl>
        ) : (
          <p className={styles.emptyState}>Chưa có OWNER. Chỉ Quản trị viên hệ thống đang quản trị tổ chức này.</p>
        )}
        </section>

        <section className={`${styles.card} ${styles.visibilityCard}`} aria-labelledby="org-visibility-heading">
        <h2 className={styles.cardTitle} id="org-visibility-heading">Hiển thị nội dung</h2>
        <dl className={`${styles.detailList} ${styles.visibilityList}`}>
          <DetailField label="Problems">{VISIBILITY_LABEL[organization.problemsVisibility]}</DetailField>
          <DetailField label="Contests">{VISIBILITY_LABEL[organization.contestsVisibility]}</DetailField>
          <DetailField label="Submissions">{VISIBILITY_LABEL[organization.submissionsVisibility]}</DetailField>
        </dl>
        </section>

        <section className={`${styles.card} ${styles.linksCard}`} aria-labelledby="org-links-heading">
        <h2 className={styles.cardTitle} id="org-links-heading">Đường dẫn</h2>
        <div className={styles.links}>
          {urlRows.map(([key, label, path]) => (
            <div className={styles.linkRow} key={key}>
              <Link className={styles.linkAnchor} to={path}>
                <ExternalLink size={15} aria-hidden="true" />
                <span>{label}: {new URL(path, window.location.origin).toString()}</span>
              </Link>
              <button className={`${styles.actionButton} ${styles.secondaryAction} ${styles.copyButton}`} type="button" onClick={() => void copyUrl(key, path)}>
                <Copy size={15} aria-hidden="true" />
                {copyState?.key === key && !copyState.error ? 'Đã sao chép' : 'Sao chép'}
              </button>
            </div>
          ))}
          {links.request && (
            <div className={styles.linkRow}>
              <Link className={styles.linkAnchor} to={links.request}>
                <ExternalLink size={15} aria-hidden="true" />
                Hồ sơ yêu cầu tạo tổ chức
              </Link>
            </div>
          )}
          {copyState && (
            <p className={styles.copyMessage} role={copyState.error ? 'alert' : 'status'}>{copyState.message}</p>
          )}
        </div>
        </section>

        {archived && (
          <section className={`${styles.card} ${styles.historyCard}`} aria-labelledby="org-history-heading">
          <h2 className={styles.cardTitle} id="org-history-heading">Lịch sử lưu trữ</h2>
          <dl className={styles.detailList}>
            <DetailField label="Thời gian lưu trữ">{dateTime(organization.archivedAt)}</DetailField>
            <DetailField label="Người lưu trữ">
              {organization.archivedBy?.username ?? organization.archivedBy?.fullName}
            </DetailField>
          </dl>
          </section>
        )}
      </div>

      <MemberManager
        slug={organization.slug}
        archived={archived}
        viewer={{ id: '', isSystemAdmin: true, role: null }}
        showOwnerNote={false}
        adminDetail
        onChanged={() => {
          void getAdminOrganization(api, id).then((fresh) => setLoaded({ id, loadKey: reloadKey, organization: fresh, error: null })).catch(() => undefined)
        }}
      />

      <OrganizationContentPanel
        slug={organization.slug}
        section="problems"
        canManage={!archived}
        archived={archived}
        showGuidance={false}
        showEmptyStateText={false}
        adminDetail
      />
      <OrganizationContentPanel
        slug={organization.slug}
        section="contests"
        canManage={!archived}
        archived={archived}
        showGuidance={false}
        showEmptyStateText={false}
        adminDetail
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
    </div>
  )
}

export default AdminOrganizationDetailPage
