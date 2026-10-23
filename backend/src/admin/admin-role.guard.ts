import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

type AuthenticatedUser = { id: string; role: 'STUDENT' | 'ADMIN' };
type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền truy cập khu vực quản trị.');
    }
    return true;
  }
}
