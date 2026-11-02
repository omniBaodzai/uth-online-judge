import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export const CONTEST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTEST_DATETIME_WITH_TIMEZONE = /(?:Z|[+-]\d{2}:\d{2})$/i;

export class CreateContestDto {
  @ApiProperty({ example: 'uth-algorithm-challenge-2026', maxLength: 120 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(CONTEST_SLUG_PATTERN)
  slug!: string;

  @ApiProperty({ example: 'UTH Algorithm Challenge 2026', maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  rules?: string | null;

  @ApiProperty({ example: '2026-11-15T09:00:00+07:00', format: 'date-time' })
  @IsDateString({ strict: true })
  @Matches(CONTEST_DATETIME_WITH_TIMEZONE, {
    message: 'startsAt must include a timezone offset or Z.',
  })
  startsAt!: string;

  @ApiProperty({ example: '2026-11-15T12:00:00+07:00', format: 'date-time' })
  @IsDateString({ strict: true })
  @Matches(CONTEST_DATETIME_WITH_TIMEZONE, {
    message: 'endsAt must include a timezone offset or Z.',
  })
  endsAt!: string;

  @ApiPropertyOptional({ enum: ['PUBLIC', 'PRIVATE'], default: 'PUBLIC' })
  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'PRIVATE';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowRegistration?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showLeaderboard?: boolean;
}

export class UpdateContestDto extends PartialType(CreateContestDto, {
  skipNullProperties: false,
}) {}

export class ListContestsQueryDto {
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
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  publicationStatus?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional({ enum: ['PUBLIC', 'PRIVATE'] })
  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'PRIVATE';

  @ApiPropertyOptional({ enum: ['UPCOMING', 'ONGOING', 'ENDED'] })
  @IsOptional()
  @IsIn(['UPCOMING', 'ONGOING', 'ENDED'])
  timeStatus?: 'UPCOMING' | 'ONGOING' | 'ENDED';
}

export class ContestProblemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  problemId!: string;

  @ApiProperty({ example: 100, minimum: 0.01, maximum: 99_999_999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999.99)
  maxScore!: number;
}

export class ReplaceContestProblemsDto {
  @ApiProperty({ type: [ContestProblemDto], maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique((item: ContestProblemDto) => item.problemId, {
    message: 'A problem may only be added to a contest once.',
  })
  @ValidateNested({ each: true })
  @Type(() => ContestProblemDto)
  problems!: ContestProblemDto[];
}
