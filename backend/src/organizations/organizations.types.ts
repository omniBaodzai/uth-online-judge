export const ORGANIZATION_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const ORGANIZATION_VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export type OrganizationVisibility = (typeof ORGANIZATION_VISIBILITIES)[number];

export const ORGANIZATION_MEMBER_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type OrganizationMemberRole = (typeof ORGANIZATION_MEMBER_ROLES)[number];

export const ORGANIZATION_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type OrganizationRequestStatus = (typeof ORGANIZATION_REQUEST_STATUSES)[number];

export type SystemRole = 'STUDENT' | 'ADMIN';

// Người dùng đã xác thực (JWT) hoặc null khi ẩn danh.
export type Viewer = { id: string; role: SystemRole } | null;

export type PublicUserProfile = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export type OrganizationRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  status: OrganizationStatus;
  problemsVisibility: OrganizationVisibility;
  contestsVisibility: OrganizationVisibility;
  submissionsVisibility: OrganizationVisibility;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  owner: PublicUserProfile | null;
};

export type AdminOrganizationRecord = OrganizationRecord & {
  archivedBy: PublicUserProfile | null;
};

export type OrganizationMemberRecord = PublicUserProfile & {
  role: OrganizationMemberRole;
  joinedAt: string;
};

export type OrganizationViewerPermissions = {
  isSystemAdmin: boolean;
  canManage: boolean;
  canEditInfo: boolean;
  canEditVisibility: boolean;
  canViewProblems: boolean;
  canViewContests: boolean;
  canViewSubmissions: boolean;
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type OrganizationRequestRecord = {
  id: string;
  fullName: string;
  workplace: string;
  position: string;
  phoneNumber: string;
  motivation: string;
  status: OrganizationRequestStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdOrganization: { id: string; slug: string; name: string } | null;
};

export type AdminCreatedOrganizationRecord = {
  id: string;
  slug: string;
  name: string;
  status: OrganizationStatus;
  owner: PublicUserProfile | null;
};

export type AdminOrganizationRequestRecord = OrganizationRequestRecord & {
  requester: (PublicUserProfile & { email: string }) | null;
  reviewer: PublicUserProfile | null;
  createdOrganizationDetails: AdminCreatedOrganizationRecord | null;
};

export type OrganizationRequestStatistics = Record<OrganizationRequestStatus, number> & {
  total: number;
};

export type AdminOrganizationRequestPage = Page<AdminOrganizationRequestRecord> & {
  statistics: OrganizationRequestStatistics;
};
