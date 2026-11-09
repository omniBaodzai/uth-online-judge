import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  StudentContestLeaderboardQuery,
  StudentContestSortField,
  StudentContestTimeStatus,
} from '../student-contests.types.js';

export class ListStudentContestsQueryDto {
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

  @ApiPropertyOptional({ maxLength: 120, description: 'Tìm theo tên hoặc slug.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: ['UPCOMING', 'ONGOING', 'ENDED'] })
  @IsOptional()
  @IsIn(['UPCOMING', 'ONGOING', 'ENDED'])
  timeStatus?: StudentContestTimeStatus;

  @ApiPropertyOptional({
    enum: ['startsAt', 'endsAt', 'title', 'participantCount'],
    default: 'startsAt',
  })
  @IsOptional()
  @IsIn(['startsAt', 'endsAt', 'title', 'participantCount'])
  sort: StudentContestSortField = 'startsAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}

export class StudentContestLeaderboardQueryDto implements StudentContestLeaderboardQuery {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ type: Number, enum: [10, 20, 50], default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([10, 20, 50])
  pageSize: 10 | 20 | 50 = 10;

  @ApiPropertyOptional({ maxLength: 100, description: 'Tìm username không phân biệt hoa/thường.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;
}
