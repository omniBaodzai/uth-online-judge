import { ApiError } from '../../auth/api'
import { errorMessage } from '../../organizations/organizations-api'
import type { AdminOrganizationRequest } from '../../organizations/organizations-api'

export type OrganizationRequestLinks = {
  public: string
  manage: string
  admin: string
}

export type OrganizationRequestLoadError = {
  title: string
  message: string
  canRetry: boolean
}

export function organizationRequestLoadError(caught: unknown): OrganizationRequestLoadError {
  const status = caught instanceof ApiError ? caught.status : null
  if (status === 401) {
    return {
      title: 'Phiên đăng nhập đã hết hạn',
      message: 'Vui lòng đăng nhập lại bằng tài khoản quản trị.',
      canRetry: false,
    }
  }
  if (status === 403) {
    return {
      title: 'Không có quyền truy cập',
      message: 'Chỉ Quản trị viên hệ thống được xem yêu cầu này.',
      canRetry: false,
    }
  }
  if (status === 404) {
    return {
      title: 'Không tìm thấy yêu cầu',
      message: 'Yêu cầu có thể đã bị xóa hoặc không tồn tại.',
      canRetry: false,
    }
  }
  return {
    title: 'Không thể tải yêu cầu',
    message: errorMessage(caught, 'Đã xảy ra lỗi khi tải chi tiết. Vui lòng thử lại.'),
    canRetry: true,
  }
}

export function adminOrganizationRequestPath(id: string): string {
  return `/admin/organization-requests/${encodeURIComponent(id)}`
}

export function organizationRequestLinks(
  request: AdminOrganizationRequest,
): OrganizationRequestLinks | null {
  const organization = request.createdOrganizationDetails
  if (request.status !== 'APPROVED' || !organization?.id || !organization.slug) return null

  const slug = encodeURIComponent(organization.slug)
  return {
    public: `/organizations/${slug}`,
    manage: `/organizations/${slug}/manage`,
    admin: `/admin/organizations/${encodeURIComponent(organization.id)}`,
  }
}
