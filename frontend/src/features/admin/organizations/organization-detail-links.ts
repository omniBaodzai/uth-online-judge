import { ApiError } from '../../auth/api'
import { errorMessage } from '../../organizations/organizations-api'
import type { AdminOrganizationDetail } from '../../organizations/organizations-api'
import type { OrganizationRequestLoadError } from './organization-request-links'
import { adminOrganizationRequestPath } from './organization-request-links'

export type OrganizationDetailLinks = {
  public: string
  manage: string
  request: string | null
}

export const adminOrganizationPath = (id: string): string =>
  `/admin/organizations/${encodeURIComponent(id)}`

export function organizationDetailLinks(
  organization: Pick<AdminOrganizationDetail, 'slug' | 'sourceRequestId'>,
): OrganizationDetailLinks {
  const slug = encodeURIComponent(organization.slug)
  return {
    public: `/organizations/${slug}`,
    manage: `/organizations/${slug}/manage`,
    request: organization.sourceRequestId ? adminOrganizationRequestPath(organization.sourceRequestId) : null,
  }
}

export function organizationDetailLoadError(caught: unknown): OrganizationRequestLoadError {
  const status = caught instanceof ApiError ? caught.status : null
  if (status === 401) {
    return { title: 'Phiên đăng nhập đã hết hạn', message: 'Vui lòng đăng nhập lại bằng tài khoản quản trị.', canRetry: false }
  }
  if (status === 403) {
    return { title: 'Không có quyền truy cập', message: 'Chỉ Quản trị viên hệ thống được xem tổ chức này.', canRetry: false }
  }
  if (status === 404) {
    return { title: 'Không tìm thấy tổ chức', message: 'Tổ chức có thể không tồn tại hoặc đường dẫn không hợp lệ.', canRetry: false }
  }
  return {
    title: 'Không thể tải tổ chức',
    message: errorMessage(caught, 'Đã xảy ra lỗi khi tải chi tiết. Vui lòng thử lại.'),
    canRetry: true,
  }
}
