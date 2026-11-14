import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { AdminDashboardSubmissionScope } from '../admin-dashboard-statistics.types.js';

export class AdminDashboardStatisticsQueryDto {
  @ApiPropertyOptional({ type: Number, enum: [7, 30, 90], default: 30 })
  @Type(() => Number)
  @IsInt()
  @IsIn([7, 30, 90])
  days: 7 | 30 | 90 = 30;

  @ApiPropertyOptional({ enum: ['GLOBAL', 'ORGANIZATION'], default: 'GLOBAL' })
  @IsIn(['GLOBAL', 'ORGANIZATION'])
  submissionScope: AdminDashboardSubmissionScope = 'GLOBAL';
}
