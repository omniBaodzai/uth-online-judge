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
  StudentContestSortField,
  StudentContestTimeStatus,
} from '../student-contests.types.js';

export class ListStudentContestsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

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
