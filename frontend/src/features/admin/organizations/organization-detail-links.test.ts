import { describe, expect, it } from 'vitest'
import { ApiError } from '../../auth/api'
import { getBreadcrumbItems } from '../../../components/navigation/breadcrumb-routes'
import {
  adminOrganizationPath,
  organizationDetailLinks,
  organizationDetailLoadError,
} from './organization-detail-links'

describe('admin organization detail navigation', () => {
  it('uses the encoded organization ID, not the slug, for the admin route', () => {
    expect(adminOrganizationPath('a/b')).toBe('/admin/organizations/a%2Fb')
  })

  it('builds public, manage and request links only from confirmed data', () => {
    expect(organizationDetailLinks({ slug: 'khoa cntt', sourceRequestId: null })).toEqual({
      public: '/organizations/khoa%20cntt',
      manage: '/organizations/khoa%20cntt/manage',
      request: null,
    })
    expect(organizationDetailLinks({ slug: 'khoa', sourceRequestId: 'req-1' }).request).toBe(
      '/admin/organization-requests/req-1',
    )
  })

  it('provides a breadcrumb back to the organization list', () => {
    expect(getBreadcrumbItems('/admin/organizations/org-id')).toEqual([
      { label: 'Admin', to: '/admin' },
      { label: 'Quản lý tổ chức', to: '/admin/organizations' },
      { label: 'Chi tiết tổ chức' },
    ])
  })

  it('maps 401, 403, 404 and recoverable errors', () => {
    expect(organizationDetailLoadError(new ApiError('x', 401))).toMatchObject({ title: 'Phiên đăng nhập đã hết hạn', canRetry: false })
    expect(organizationDetailLoadError(new ApiError('x', 403))).toMatchObject({ title: 'Không có quyền truy cập', canRetry: false })
    expect(organizationDetailLoadError(new ApiError('x', 404))).toMatchObject({ title: 'Không tìm thấy tổ chức', canRetry: false })
    expect(organizationDetailLoadError(new Error('offline'))).toMatchObject({ title: 'Không thể tải tổ chức', canRetry: true })
  })
})
