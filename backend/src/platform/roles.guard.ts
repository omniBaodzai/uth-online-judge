import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export type UserRole = 'ADMIN' | 'MODERATOR' | 'USER';
export const USER_ROLES: UserRole[] = ['ADMIN', 'MODERATOR', 'USER'];

const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Dùng sau JwtAuthGuard; vai trò được JwtStrategy đọc mới từ DB nên đổi role/khóa tài khoản có hiệu lực ngay. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: { role?: UserRole } }>();
    if (!request.user?.role || !required.includes(request.user.role)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này.');
    }
    return true;
  }
}
