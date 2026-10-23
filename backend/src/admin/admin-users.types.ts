export type AdminUserRole = 'STUDENT' | 'ADMIN';
export type AdminUserStatus = 'active' | 'inactive';
export type AdminUserAuthMethod = 'password' | 'google' | 'github';

// Chỉ chứa các trường an toàn: không có password_hash, token hay OAuth id.
export type AdminUser = {
  id: string;
  username: string | null;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: AdminUserRole;
  isActive: boolean;
  authMethods: AdminUserAuthMethod[];
  createdAt: string;
  updatedAt: string;
};

export type AdminUserListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  role?: AdminUserRole;
  status?: AdminUserStatus;
};

export type AdminUserPage = {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUserChange = { role: AdminUserRole } | { isActive: boolean };
