import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { AssignableRole } from './organization-member-policy.js';
import {
  OrganizationsRepository,
  type AdminRequestListQuery,
  type ApproveRequestInput,
  type MemberListQuery,
  type NewOrganizationRequest,
  type OrganizationInfoInput,
  type OrganizationInfoPatch,
  type OrganizationListQuery,
  type VisibilityPatch,
} from './organizations.repository.js';
import type {
  AdminOrganizationRecord,
  OrganizationMemberRole,
  OrganizationRecord,
  OrganizationViewerPermissions,
  Viewer,
} from './organizations.types.js';

export const REQUEST_LIMIT_PER_DAY = 5;

function requireViewer(viewer: Viewer): NonNullable<Viewer> {
  if (!viewer) throw new UnauthorizedException('Vui lòng đăng nhập.');
  return viewer;
}

const actorOf = (viewer: Viewer) => {
  const user = requireViewer(viewer);
  return { id: user.id, isSystemAdmin: user.role === 'ADMIN' };
};

type OrganizationContext = {
  organization: AdminOrganizationRecord;
  viewerRole: OrganizationMemberRole | null;
  permissions: OrganizationViewerPermissions;
};

export function computePermissions(
  organization: Pick<
    OrganizationRecord,
    'status' | 'problemsVisibility' | 'contestsVisibility' | 'submissionsVisibility'
  >,
  viewer: Viewer,
  viewerRole: OrganizationMemberRole | null,
): OrganizationViewerPermissions {
  const isSystemAdmin = viewer?.role === 'ADMIN';
  const isManager = viewerRole === 'OWNER' || viewerRole === 'ADMIN';
  const active = organization.status === 'ACTIVE';
  const canSee = (visibility: 'PUBLIC' | 'PRIVATE') =>
    isSystemAdmin || visibility === 'PUBLIC' || viewerRole !== null;
  return {
    isSystemAdmin,
    canManage: isSystemAdmin || isManager,
    canEditInfo: active && (isSystemAdmin || isManager),
    canEditVisibility: active && (isSystemAdmin || isManager),
    canViewProblems: canSee(organization.problemsVisibility),
    canViewContests: canSee(organization.contestsVisibility),
    canViewSubmissions: canSee(organization.submissionsVisibility),
  };
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly repository: OrganizationsRepository) {}

  // ---------- Yêu cầu tạo tổ chức (người dùng) ----------

  async createRequest(userId: string, input: NewOrganizationRequest) {
    const recent = await this.repository.countRecentRequests(userId, 24);
    if (recent >= REQUEST_LIMIT_PER_DAY) {
      throw new HttpException(
        'Bạn đã gửi quá nhiều yêu cầu trong 24 giờ qua. Vui lòng thử lại sau.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.repository.createRequest(userId, input);
  }

  listOwnRequests(userId: string, page: number, pageSize: number) {
    return this.repository.listOwnRequests(userId, page, pageSize);
  }

  // ---------- Admin: xét duyệt ----------

  listAdminRequests(query: AdminRequestListQuery) {
    return this.repository.listAdminRequests(query);
  }

  async getAdminRequest(id: string) {
    const request = await this.repository.findAdminRequest(id);
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu tạo tổ chức.');
    return request;
  }

  approveRequest(id: string, adminId: string, input: ApproveRequestInput) {
    return this.repository.approveRequest(id, adminId, input);
  }

  rejectRequest(id: string, adminId: string, reviewNote: string | null) {
    return this.repository.rejectRequest(id, adminId, reviewNote);
  }

  // ---------- Admin: quản lý tổ chức ----------

  listAdminOrganizations(query: OrganizationListQuery) {
    return this.repository.listAdminOrganizations(query);
  }

  async getAdminOrganization(id: string) {
    const organization = await this.repository.findById(id);
    if (!organization) throw new NotFoundException('Không tìm thấy tổ chức.');
    const sourceRequestId = await this.repository.findSourceRequestId(id);
    return { ...organization, sourceRequestId };
  }

  async listAdminMembers(id: string, query: MemberListQuery) {
    if (!(await this.repository.findById(id))) throw new NotFoundException('Không tìm thấy tổ chức.');
    return this.repository.listMembers(id, query);
  }

  createOrganization(input: OrganizationInfoInput) {
    return this.repository.createOrganization(input);
  }

  async updateOrganizationById(id: string, patch: OrganizationInfoPatch) {
    return this.repository.updateInfo(id, patch);
  }

  changeOwner(id: string, ownerIdentifier: string | null, previousRole: 'ADMIN' | 'MEMBER') {
    return this.repository.changeOwner(id, ownerIdentifier, previousRole);
  }

  archive(id: string, adminId: string) {
    return this.repository.archive(id, adminId);
  }

  restore(id: string) {
    return this.repository.restore(id);
  }

  // ---------- Thông tin tổ chức ----------

  listOrganizations(query: OrganizationListQuery) {
    return this.repository.listOrganizations(query);
  }

  async getOrganization(slug: string, viewer: Viewer) {
    const context = await this.loadContext(slug, viewer);
    return this.present(context, viewer);
  }

  async listMembers(slug: string, viewer: Viewer, query: MemberListQuery) {
    const { organization } = await this.loadContext(slug, viewer);
    return this.repository.listMembers(organization.id, query);
  }

  // ---------- Thành viên ----------

  async join(slug: string, viewer: Viewer) {
    const { organization } = await this.loadContext(slug, viewer);
    await this.repository.joinOrganization(organization.id, requireViewer(viewer).id);
    return this.reload(organization.id, viewer);
  }

  async leave(slug: string, viewer: Viewer) {
    const { organization } = await this.loadContext(slug, viewer);
    await this.repository.leaveOrganization(organization.id, requireViewer(viewer).id);
    return this.reload(organization.id, viewer);
  }

  async addMember(slug: string, viewer: Viewer, identifier: string, role: AssignableRole) {
    const { organization } = await this.loadContext(slug, viewer);
    return this.repository.addMember(organization.id, actorOf(viewer), identifier, role);
  }

  async changeMemberRole(slug: string, viewer: Viewer, userId: string, role: AssignableRole) {
    const { organization } = await this.loadContext(slug, viewer);
    return this.repository.changeMemberRole(organization.id, actorOf(viewer), userId, role);
  }

  async removeMember(slug: string, viewer: Viewer, userId: string) {
    const { organization } = await this.loadContext(slug, viewer);
    await this.repository.removeMember(organization.id, actorOf(viewer), userId);
    return { removed: true };
  }

  async getMyRole(slug: string, viewer: Viewer) {
    const { viewerRole, permissions } = await this.loadContext(slug, viewer);
    return { viewerRole, viewerPermissions: permissions };
  }

  async getManage(slug: string, viewer: Viewer) {
    const context = await this.loadContext(slug, viewer);
    if (!context.permissions.canManage) {
      throw new ForbiddenException('Bạn không có quyền quản lý tổ chức này.');
    }
    return this.present(context, viewer);
  }

  async getProblemAccess(slug: string, viewer: Viewer) {
    const context = await this.loadContext(slug, viewer);
    if (!context.permissions.canViewProblems) {
      throw new ForbiddenException('Bạn không có quyền xem bài tập của tổ chức này.');
    }
    return {
      organizationId: context.organization.id,
      status: context.organization.status,
      canManage: context.permissions.canManage,
    };
  }

  async getContestAccess(slug: string, viewer: Viewer) {
    const context = await this.loadContext(slug, viewer);
    if (!context.permissions.canViewContests) {
      throw new ForbiddenException('Bạn không có quyền xem kỳ thi của tổ chức này.');
    }
    return {
      organizationId: context.organization.id,
      status: context.organization.status,
      canManage: context.permissions.canManage,
      viewerRole: context.viewerRole,
      isSystemAdmin: context.permissions.isSystemAdmin,
    };
  }

  async getSubmissionAccess(slug: string, viewer: Viewer) {
    const context = await this.loadContext(slug, viewer);
    return {
      organizationId: context.organization.id,
      status: context.organization.status,
      viewerRole: context.viewerRole,
      isSystemAdmin: context.permissions.isSystemAdmin,
      canManage: context.permissions.canManage,
      canViewSubmissions: context.permissions.canViewSubmissions,
    };
  }

  async getLeaderboardAccess(slug: string, viewer: Viewer) {
    const { organization } = await this.loadContext(slug, viewer);
    return { organizationId: organization.id };
  }

  async updateInfo(slug: string, viewer: Viewer, patch: OrganizationInfoPatch) {
    const context = await this.loadContext(slug, viewer);
    this.assertCanEdit(context);
    await this.repository.updateInfo(context.organization.id, patch);
    return this.reload(context.organization.id, viewer);
  }

  async updateVisibility(slug: string, viewer: Viewer, patch: VisibilityPatch) {
    if (Object.values(patch).every((value) => value === undefined)) {
      throw new BadRequestException('Cần ít nhất một thiết lập hiển thị để cập nhật.');
    }
    const context = await this.loadContext(slug, viewer);
    this.assertCanEdit(context);
    await this.repository.updateVisibility(context.organization.id, patch);
    return this.reload(context.organization.id, viewer);
  }

  // ---------- Nội bộ ----------

  private assertCanEdit({ organization, permissions }: OrganizationContext) {
    if (!permissions.canManage) throw new ForbiddenException('Bạn không có quyền chỉnh sửa tổ chức này.');
    if (organization.status === 'ARCHIVED') {
      throw new ConflictException('Tổ chức đã được lưu trữ. Hãy khôi phục trước khi chỉnh sửa.');
    }
  }

  // Tổ chức đã lưu trữ chỉ hiển thị với Admin hệ thống; người khác nhận 404 để không lộ sự tồn tại.
  private async loadContext(slug: string, viewer: Viewer): Promise<OrganizationContext> {
    const organization = await this.repository.findBySlug(slug);
    const isSystemAdmin = viewer?.role === 'ADMIN';
    if (!organization || (organization.status === 'ARCHIVED' && !isSystemAdmin)) {
      throw new NotFoundException('Không tìm thấy tổ chức.');
    }
    const viewerRole = viewer ? await this.repository.findMemberRole(organization.id, viewer.id) : null;
    return { organization, viewerRole, permissions: computePermissions(organization, viewer, viewerRole) };
  }

  private async reload(id: string, viewer: Viewer) {
    const organization = await this.repository.findById(id);
    if (!organization) throw new NotFoundException('Không tìm thấy tổ chức.');
    const viewerRole = viewer ? await this.repository.findMemberRole(id, viewer.id) : null;
    return this.present(
      { organization, viewerRole, permissions: computePermissions(organization, viewer, viewerRole) },
      viewer,
    );
  }

  private present({ organization, viewerRole, permissions }: OrganizationContext, viewer: Viewer) {
    const { archivedBy, ...publicFields } = organization;
    return {
      ...publicFields,
      ...(viewer?.role === 'ADMIN' ? { archivedBy } : {}),
      viewerRole,
      viewerPermissions: permissions,
    };
  }
}
