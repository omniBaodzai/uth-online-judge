import { Injectable } from '@nestjs/common';
import { AdminUsersRepository } from './admin-users.repository.js';
import type { AdminUserListQuery, AdminUserRole } from './admin-users.types.js';
import type { ListAdminUsersQueryDto } from './dto/admin-user.dto.js';

@Injectable()
export class AdminUsersService {
  constructor(private readonly repository: AdminUsersRepository) {}

  list(query: ListAdminUsersQueryDto) {
    const normalized: AdminUserListQuery = {
      page: query.page,
      pageSize: query.pageSize,
      ...(query.search ? { search: query.search } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    return this.repository.listUsers(normalized);
  }

  get(id: string) {
    return this.repository.findUser(id);
  }

  setRole(id: string, role: AdminUserRole, actorId: string) {
    return this.repository.applyChange(id, actorId, { role });
  }

  setActive(id: string, isActive: boolean, actorId: string) {
    return this.repository.applyChange(id, actorId, { isActive });
  }
}
