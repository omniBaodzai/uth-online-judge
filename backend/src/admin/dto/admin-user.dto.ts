import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { AdminUserRole, AdminUserStatus } from '../admin-users.types.js';

export class ListAdminUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['STUDENT', 'ADMIN'])
  role?: AdminUserRole;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: AdminUserStatus;
}

export class AdminUserRoleDto {
  @IsIn(['STUDENT', 'ADMIN'])
  role!: AdminUserRole;
}

export class AdminUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
