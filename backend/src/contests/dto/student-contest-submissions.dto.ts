import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SUBMISSION_STATUSES } from '../../submissions/dto/problem-submissions.dto.js';

export class StudentContestSubmissionsQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @ApiPropertyOptional({ type: Number, enum: [10, 20, 50], default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([10, 20, 50])
  pageSize: 10 | 20 | 50 = 10;

  @ApiPropertyOptional({ maxLength: 100, description: 'Tìm username, mã hoặc tên bài.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: SUBMISSION_STATUSES })
  @IsOptional()
  @IsIn(SUBMISSION_STATUSES)
  status?: (typeof SUBMISSION_STATUSES)[number];

  @ApiPropertyOptional({ maxLength: 100, description: 'Tên ngôn ngữ chính xác.' })
  @IsOptional()
  @IsString()
  @Matches(/^[\p{L}\p{N} ._()+#-]{1,100}$/u)
  language?: string;
}

export class StudentContestSubmissionItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ACCEPTED', enum: SUBMISSION_STATUSES })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  submittedAt!: string;

  @ApiProperty({ nullable: true })
  username!: string | null;

  @ApiProperty()
  problemCode!: string;

  @ApiProperty()
  problemTitle!: string;

  @ApiProperty()
  language!: string;

  @ApiProperty({ nullable: true })
  executionTimeMs!: number | null;

  @ApiProperty({ nullable: true })
  memoryUsedKb!: number | null;

  @ApiProperty({ description: 'True only when the authenticated viewer owns this submission.' })
  canViewDetails!: boolean;
}

export class StudentContestSubmissionStatisticsResponseDto {
  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  accepted!: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  acceptanceRate!: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  verdictCounts!: Record<string, number>;
}

export class StudentContestSubmissionFiltersResponseDto {
  @ApiProperty({ type: [String] })
  languages!: string[];
}

export class StudentContestSubmissionsPageResponseDto {
  @ApiProperty({ type: [StudentContestSubmissionItemResponseDto] })
  items!: StudentContestSubmissionItemResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ enum: [10, 20, 50] })
  pageSize!: number;

  @ApiProperty({ type: StudentContestSubmissionStatisticsResponseDto })
  statistics!: StudentContestSubmissionStatisticsResponseDto;

  @ApiProperty({ type: StudentContestSubmissionFiltersResponseDto })
  filters!: StudentContestSubmissionFiltersResponseDto;
}
