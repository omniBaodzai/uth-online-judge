import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  AdminOrganizationRequestsController,
  AdminOrganizationsController,
  OrganizationRequestsController,
  OrganizationsController,
} from './organizations.controller.js';
import { ChangeOrganizationOwnerDto, CreateOrganizationRequestDto, UpdateOrganizationDto } from './organizations.dto.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { OrganizationLeaderboardQueryDto } from './organization-leaderboard.dto.js';
import { isValidSlug, slugify } from './organization-slug.js';
import { OrganizationsService, computePermissions } from './organizations.service.js';
import type { OrganizationsRepository } from './organizations.repository.js';

const org = { status: 'ACTIVE', problemsVisibility: 'PRIVATE', contestsVisibility: 'PUBLIC', submissionsVisibility: 'PRIVATE' } as const;
const user = { id: 'u1', role: 'STUDENT' } as const;

describe('computePermissions', () => {
  it('ẩn danh chỉ xem nội dung PUBLIC, không quản lý', () => {
    const p = computePermissions(org, null, null);
    expect(p).toMatchObject({ canManage: false, canViewProblems: false, canViewContests: true, isSystemAdmin: false });
  });
  it('MEMBER xem được nội dung PRIVATE nhưng không quản lý', () => {
    expect(computePermissions(org, user, 'MEMBER')).toMatchObject({ canManage: false, canViewProblems: true });
  });
  it('OWNER và ADMIN tổ chức quản lý nhưng không phải Admin hệ thống', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      expect(computePermissions(org, user, role)).toMatchObject({ canManage: true, canEditInfo: true, isSystemAdmin: false });
    }
  });
  it('Admin hệ thống toàn quyền, kể cả không là thành viên', () => {
    expect(computePermissions(org, { id: 'a', role: 'ADMIN' }, null)).toMatchObject({
      isSystemAdmin: true, canManage: true, canViewProblems: true, canViewSubmissions: true,
    });
  });
  it('tổ chức ARCHIVED không cho chỉnh sửa, kể cả Admin', () => {
    const p = computePermissions({ ...org, status: 'ARCHIVED' }, { id: 'a', role: 'ADMIN' }, null);
    expect(p).toMatchObject({ canManage: true, canEditInfo: false, canEditVisibility: false });
  });
});

describe('OrganizationsService', () => {
  it('giới hạn 5 yêu cầu / 24h với HTTP 429', async () => {
    const repository = { countRecentRequests: vi.fn().mockResolvedValue(5), createRequest: vi.fn() };
    const service = new OrganizationsService(repository as unknown as OrganizationsRepository);
    await expect(service.createRequest('u1', {} as never)).rejects.toMatchObject({ status: 429 });
    expect(repository.createRequest).not.toHaveBeenCalled();
  });

  it('visibility rỗng bị từ chối trước khi chạm DB', async () => {
    const repository = { findBySlug: vi.fn() };
    const service = new OrganizationsService(repository as unknown as OrganizationsRepository);
    await expect(service.updateVisibility('x', user, {})).rejects.toMatchObject({ status: 400 });
    expect(repository.findBySlug).not.toHaveBeenCalled();
  });

  it('tổ chức ARCHIVED trả 404 cho người không phải Admin hệ thống', async () => {
    const repository = { findBySlug: vi.fn().mockResolvedValue({ ...org, id: 'o', status: 'ARCHIVED' }), findMemberRole: vi.fn() };
    const service = new OrganizationsService(repository as unknown as OrganizationsRepository);
    await expect(service.getOrganization('x', user)).rejects.toMatchObject({ status: 404 });
  });

  it('leaderboard ACTIVE không phụ thuộc visibility của tab; ARCHIVED chỉ dành cho Admin hệ thống', async () => {
    const repository = {
      findBySlug: vi.fn().mockResolvedValue({
        ...org,
        id: 'o',
        status: 'ACTIVE',
        problemsVisibility: 'PRIVATE',
        submissionsVisibility: 'PRIVATE',
      }),
      findMemberRole: vi.fn().mockResolvedValue(null),
    };
    const service = new OrganizationsService(repository as unknown as OrganizationsRepository);
    await expect(service.getLeaderboardAccess('x', null)).resolves.toEqual({ organizationId: 'o' });

    repository.findBySlug.mockResolvedValue({ ...org, id: 'o', status: 'ARCHIVED' });
    await expect(service.getLeaderboardAccess('x', user)).rejects.toMatchObject({ status: 404 });
    await expect(service.getLeaderboardAccess('x', { id: 'admin', role: 'ADMIN' })).resolves.toEqual({
      organizationId: 'o',
    });
  });

  it('chi tiết admin theo ID trả 404 khi không tồn tại', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(null), findSourceRequestId: vi.fn() };
    const service = new OrganizationsService(repository as unknown as OrganizationsRepository);
    await expect(service.getAdminOrganization('id')).rejects.toMatchObject({ status: 404 });
    await expect(service.listAdminMembers('id', { page: 1, pageSize: 10 })).rejects.toMatchObject({ status: 404 });
    expect(repository.findSourceRequestId).not.toHaveBeenCalled();
  });
});

describe('route guards', () => {
  const guards = (target: object) => Reflect.getMetadata('__guards__', target) as unknown[];
  it('yêu cầu của người dùng cần JWT', () => {
    expect(guards(OrganizationRequestsController)).toContain(JwtAuthGuard);
  });
  it('API admin cần JWT và AdminRoleGuard', () => {
    for (const controller of [AdminOrganizationRequestsController, AdminOrganizationsController]) {
      expect(guards(controller)).toEqual([JwtAuthGuard, AdminRoleGuard]);
    }
  });
  it('leaderboard organization chấp nhận khách và viewer đăng nhập tùy chọn', () => {
    expect(Reflect.getMetadata('__guards__', OrganizationsController.prototype, 'leaderboardPage')).toContain(
      OptionalJwtAuthGuard,
    );
    const handler = Object.getOwnPropertyDescriptor(OrganizationsController.prototype, 'leaderboardPage')?.value;
    expect(Reflect.getMetadata('path', handler)).toBe(':slug/leaderboard');
  });
});

describe('DTO và slug', () => {
  it('slugify bỏ dấu tiếng Việt', () => {
    expect(slugify('Khoa Công nghệ Thông tin Đại học')).toBe('khoa-cong-nghe-thong-tin-dai-hoc');
    expect(slugify('!!')).toBeNull();
    expect(isValidSlug('a--b')).toBe(false);
  });
  it('từ chối trường lạ, số điện thoại sai và slug không hợp lệ', async () => {
    const request = plainToInstance(CreateOrganizationRequestDto, {
      fullName: 'A', workplace: 'B', position: 'C', phoneNumber: 'abc', motivation: 'D',
    });
    expect((await validate(request)).map((e) => e.property)).toEqual(['phoneNumber']);
    const patch = plainToInstance(UpdateOrganizationDto, { slug: 'Bad Slug!' });
    expect((await validate(patch)).map((e) => e.property)).toContain('slug');
    const upper = plainToInstance(UpdateOrganizationDto, { slug: 'Khoa-CNTT' });
    expect(await validate(upper)).toHaveLength(0);
    expect(upper.slug).toBe('khoa-cntt');
  });
  it('ownerIdentifier cho phép null để gỡ OWNER', async () => {
    const dto = plainToInstance(ChangeOrganizationOwnerDto, { ownerIdentifier: null });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.previousOwnerRole).toBe('ADMIN');
  });
  it('kiểm tra page và pageSize của leaderboard', async () => {
    const invalid = plainToInstance(OrganizationLeaderboardQueryDto, { page: 0, pageSize: 51 });
    expect((await validate(invalid)).map((error) => error.property).sort()).toEqual(['page', 'pageSize']);
    const defaults = plainToInstance(OrganizationLeaderboardQueryDto, {});
    expect(defaults).toMatchObject({ page: 1, pageSize: 20 });
  });
});
