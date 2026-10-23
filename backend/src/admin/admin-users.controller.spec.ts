import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminUserRoleDto, AdminUserStatusDto, ListAdminUsersQueryDto } from './dto/admin-user.dto.js';

describe('Admin user DTOs', () => {
  it('applies defaults and trims search text', async () => {
    const query = plainToInstance(ListAdminUsersQueryDto, { search: '  an  ', page: '2', role: 'ADMIN', status: 'active' });
    expect(query).toMatchObject({ page: 2, pageSize: 20, search: 'an' });
    await expect(validate(query)).resolves.toHaveLength(0);
  });

  it('rejects unsupported filters, roles and non-boolean status', async () => {
    const query = plainToInstance(ListAdminUsersQueryDto, { role: 'ROOT', status: 'banned', pageSize: '1000' });
    const properties = (await validate(query)).map((error) => error.property).sort();
    expect(properties).toEqual(['pageSize', 'role', 'status']);
    expect(await validate(plainToInstance(AdminUserRoleDto, { role: 'SUPERUSER' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(AdminUserStatusDto, { isActive: 'yes' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(AdminUserRoleDto, { role: 'ADMIN' }))).toHaveLength(0);
  });
});

describe('AdminUsersController', () => {
  it('passes the authenticated admin id to the service as the actor', () => {
    const service = { setRole: vi.fn(), setActive: vi.fn() };
    const controller = new AdminUsersController(service as unknown as AdminUsersService);
    const request = { user: { id: 'admin-1', role: 'ADMIN' } } as never;

    void controller.setRole('target', { role: 'ADMIN' }, request);
    void controller.setStatus('target', { isActive: false }, request);

    expect(service.setRole).toHaveBeenCalledWith('target', 'ADMIN', 'admin-1');
    expect(service.setActive).toHaveBeenCalledWith('target', false, 'admin-1');
  });

  it('is protected by JwtAuthGuard and AdminRoleGuard, which rejects students', () => {
    const guards = Reflect.getMetadata('__guards__', AdminUsersController) as Array<{ name: string }>;
    expect(guards.map((guard) => guard.name)).toEqual(['JwtAuthGuard', 'AdminRoleGuard']);

    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 's', role: 'STUDENT' } }) }),
    } as unknown as ExecutionContext;
    expect(() => new AdminRoleGuard().canActivate(context)).toThrow(ForbiddenException);
  });
});
