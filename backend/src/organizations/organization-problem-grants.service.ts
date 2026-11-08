import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { OrganizationProblemGrantsRepository, type OrganizationProblemGrantScope } from './organization-problem-grants.repository.js';
import { OrganizationsService } from './organizations.service.js';
import type { Viewer } from './organizations.types.js';

@Injectable()
export class OrganizationProblemGrantsService {
  constructor(
    private readonly grants: OrganizationProblemGrantsRepository,
    private readonly organizations: OrganizationsService,
  ) {}

  async list(slug: string, problemId: string, viewer: Viewer) {
    const access = await this.organizations.getProblemAccess(slug, viewer);
    this.assertManager(access.canManage);
    return this.grants.list(problemId, access.organizationId);
  }

  async create(
    slug: string,
    problemId: string,
    viewer: Viewer,
    scope: OrganizationProblemGrantScope,
    granteeOrganizationId: string | null,
  ) {
    const access = await this.organizations.getProblemAccess(slug, viewer);
    this.assertCanMutate(access.canManage, access.status);
    const actor = this.actor(viewer);
    try {
      return await this.grants.create(
        problemId,
        access.organizationId,
        scope,
        granteeOrganizationId,
        actor,
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Đã có grant còn hiệu lực cho bài tập và phạm vi này.');
      }
      if (isConstraintViolation(error)) {
        throw new ConflictException('Không thể cấp grant theo trạng thái hoặc phạm vi hiện tại.');
      }
      throw error;
    }
  }

  async revoke(slug: string, problemId: string, grantId: string, viewer: Viewer) {
    const access = await this.organizations.getProblemAccess(slug, viewer);
    this.assertCanMutate(access.canManage, access.status);
    return this.grants.revoke(problemId, grantId, access.organizationId, this.actor(viewer));
  }

  private assertManager(canManage: boolean) {
    if (!canManage) {
      throw new ForbiddenException('Chỉ OWNER, Organization ADMIN hoặc System Admin được quản lý grant.');
    }
  }

  private assertCanMutate(canManage: boolean, status: string) {
    this.assertManager(canManage);
    if (status !== 'ACTIVE') {
      throw new ConflictException('Tổ chức đã được lưu trữ; không thể thay đổi grant.');
    }
  }

  private actor(viewer: Viewer) {
    if (!viewer) throw new UnauthorizedException('Vui lòng đăng nhập.');
    return { userId: viewer.id, isSystemAdmin: viewer.role === 'ADMIN' };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function isConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23514';
}
