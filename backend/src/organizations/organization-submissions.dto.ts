import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { SUBMISSION_STATUSES } from '../submissions/dto/problem-submissions.dto.js';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationSubmissionQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @ApiPropertyOptional({ type: Number, default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 10;

  @ApiPropertyOptional({ format: 'uuid', description: 'Lọc theo bài tập.' })
  @IsOptional()
  @IsUUID('4')
  problemId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Lọc theo kỳ thi.' })
  @IsOptional()
  @IsUUID('4')
  contestId?: string;

  @ApiPropertyOptional({ enum: SUBMISSION_STATUSES })
  @IsOptional()
  @IsIn(SUBMISSION_STATUSES)
  status?: (typeof SUBMISSION_STATUSES)[number];

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  language?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Chỉ quản trị viên được dùng bộ lọc này.' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
