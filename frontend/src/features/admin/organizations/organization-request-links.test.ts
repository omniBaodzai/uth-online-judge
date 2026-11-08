import { describe, expect, it } from 'vitest'
import { ApiError } from '../../auth/api'
import type { AdminOrganizationRequest } from '../../organizations/organizations-api'
import { getBreadcrumbItems } from '../../../components/navigation/breadcrumb-routes'
import {
  adminOrganizationRequestPath,
  organizationRequestLinks,
  organizationRequestLoadError,
} from './organization-request-links'

const request = (status: AdminOrganizationRequest['status']): AdminOrganizationRequest => ({
  id: 'request-id',
  fullName: 'Nguyễn Văn A',
  workplace: 'Khoa CNTT',
  position: 'Giảng viên',
  phoneNumber: '0901234567',
  motivation: 'Tạo tổ chức',
  status,
  reviewNote: null,
  reviewedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  requester: { id: 'user-id', username: 'user-a', fullName: 'Nguyễn Văn A', avatarUrl: null, email: 'a@example.test' },
  reviewer: null,
  createdOrganization: { id: 'org-id', slug: 'khoa-cntt', name: 'Khoa CNTT' },
  createdOrganizationDetails: {
    id: 'org-id',
    slug: 'khoa cntt',
    name: 'Khoa CNTT',
    status: 'ACTIVE',
    owner: { id: 'owner-id', username: 'owner-a', fullName: null, avatarUrl: null },
  },
})

describe('organization request detail navigation', () => {
  it('encodes the request ID for the detail route', () => {
    expect(adminOrganizationRequestPath('request/id')).toBe('/admin/organization-requests/request%2Fid')
  })

  it('only generates approved-organization routes from confirmed organization data', () => {
    expect(organizationRequestLinks(request('PENDING'))).toBeNull()
    expect(organizationRequestLinks(request('REJECTED'))).toBeNull()
    expect(organizationRequestLinks(request('APPROVED'))).toEqual({
      public: '/organizations/khoa%20cntt',
      manage: '/organizations/khoa%20cntt/manage',
      admin: '/admin/organizations/org-id',
    })
    expect(organizationRequestLinks({
      ...request('APPROVED'),
      createdOrganizationDetails: null,
    })).toBeNull()
  })

  it('provides a breadcrumb back to the request list', () => {
    expect(getBreadcrumbItems('/admin/organization-requests/request-id')).toEqual([
      { label: 'Admin', to: '/admin' },
      { label: 'Quản lý tổ chức', to: '/admin/organizations' },
      { label: 'Yêu cầu tạo tổ chức', to: '/admin/organizations?tab=requests' },
      { label: 'Chi tiết yêu cầu' },
    ])
  })

  it('maps authorization, not-found and recoverable API errors', () => {
    expect(organizationRequestLoadError(new ApiError('Unauthorized', 401))).toMatchObject({
      title: 'Phiên đăng nhập đã hết hạn',
      canRetry: false,
    })
    expect(organizationRequestLoadError(new ApiError('Forbidden', 403))).toMatchObject({
      title: 'Không có quyền truy cập',
      canRetry: false,
    })
    expect(organizationRequestLoadError(new ApiError('Not found', 404))).toMatchObject({
      title: 'Không tìm thấy yêu cầu',
      canRetry: false,
    })
    expect(organizationRequestLoadError(new Error('offline'))).toMatchObject({
      title: 'Không thể tải yêu cầu',
      canRetry: true,
    })
  })
})
