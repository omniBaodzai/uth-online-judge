import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { OrganizationMemberRole } from './organizations.types.js';

export type MemberActor = { isSystemAdmin: boolean; role: OrganizationMemberRole | null };
export type AssignableRole = Exclude<OrganizationMemberRole, 'OWNER'>;

const OWNER_VIA_ADMIN_MESSAGE = 'OWNER chỉ được chuyển hoặc gỡ bởi Quản trị viên hệ thống qua chức năng đổi OWNER.';

const isOwnerLike = (actor: MemberActor) => actor.isSystemAdmin || actor.role === 'OWNER';

export function assertCanAddMember(actor: MemberActor, newRole: AssignableRole): void {
  if (!isOwnerLike(actor) && actor.role !== 'ADMIN') {
    throw new ForbiddenException('Bạn không có quyền thêm thành viên.');
  }
  if (newRole === 'ADMIN' && !isOwnerLike(actor)) {
    throw new ForbiddenException('Chỉ OWNER hoặc Quản trị viên hệ thống được cấp quyền quản trị tổ chức.');
  }
}

export function assertCanChangeRole(actor: MemberActor, targetRole: OrganizationMemberRole): void {
  if (!isOwnerLike(actor)) throw new ForbiddenException('Bạn không có quyền thay đổi vai trò thành viên.');
  if (targetRole === 'OWNER') throw new ConflictException(OWNER_VIA_ADMIN_MESSAGE);
}

export function assertCanRemoveMember(actor: MemberActor, targetRole: OrganizationMemberRole): void {
  if (targetRole === 'OWNER') throw new ConflictException(OWNER_VIA_ADMIN_MESSAGE);
  if (isOwnerLike(actor)) return;
  if (actor.role === 'ADMIN' && targetRole === 'MEMBER') return;
  throw new ForbiddenException('Bạn không có quyền xóa thành viên này.');
}
