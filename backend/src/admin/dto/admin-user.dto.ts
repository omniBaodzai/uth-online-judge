import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { AdminUserRole, AdminUserStatus } from '../admin-users.types.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListAdminUsersQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ type: Number, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ['STUDENT', 'ADMIN'] })
  @IsOptional()
  @IsIn(['STUDENT', 'ADMIN'])
  role?: AdminUserRole;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: AdminUserStatus;
}

export class AdminUserRoleDto {
  @ApiProperty({ enum: ['STUDENT', 'ADMIN'] })
  @IsIn(['STUDENT', 'ADMIN'])
  role!: AdminUserRole;
}

export class AdminUserStatusDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  isActive!: boolean;
}
