import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminController } from './admin.controller.js';
import { AdminRoleGuard } from './admin-role.guard.js';

describe('AdminRoleGuard', () => {
  const guard = new AdminRoleGuard();

  function context(role?: 'STUDENT' | 'ADMIN') {
    return {
      switchToHttp: () => ({
        getRequest: () => role ? { user: { id: 'user-1', role } } : {},
      }),
    } as never;
  }

  it('allows an authenticated Admin', () => {
    expect(guard.canActivate(context('ADMIN'))).toBe(true);
  });

  it('rejects students and missing users', () => {
    expect(() => guard.canActivate(context('STUDENT'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
  });

  it('protects every Admin endpoint with JWT and role guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([
      expect.any(Function),
      AdminRoleGuard,
    ]);
  });
});
