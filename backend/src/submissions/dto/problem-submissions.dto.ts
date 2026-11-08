import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SUBMISSION_STATUSES = [
  'PENDING',
  'QUEUED',
  'RUNNING',
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILATION_ERROR',
  'INTERNAL_ERROR',
] as const;

export class ProblemSubmissionsParamsDto {
  @ApiProperty({ example: 'problem_code', maxLength: 50 })
  @IsString({ message: 'Mã bài tập phải là chuỗi ký tự.' })
  @Matches(/^[A-Za-z0-9_-]{1,50}$/, { message: 'Mã bài tập không hợp lệ.' })
  problemCode!: string;
}

export class ProblemSubmissionsQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải lớn hơn 0.' })
  page: number = 1;

  @ApiPropertyOptional({ type: Number, default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bài mỗi trang phải là số nguyên.' })
  @Min(1, { message: 'Số bài mỗi trang phải lớn hơn 0.' })
  @Max(50, { message: 'Số bài mỗi trang không được vượt quá 50.' })
  pageSize: number = 10;

  @ApiPropertyOptional({ enum: SUBMISSION_STATUSES })
  @IsOptional()
  @IsIn(SUBMISSION_STATUSES, { message: 'Trạng thái bài nộp không hợp lệ.' })
  status?: (typeof SUBMISSION_STATUSES)[number];

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'Ngôn ngữ phải là chuỗi ký tự.' })
  @Matches(/^[\p{L}\p{N} ._()+#-]{1,100}$/u, { message: 'Ngôn ngữ không hợp lệ.' })
  language?: string;
}

export class BestSubmissionsQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải lớn hơn 0.' })
  @Max(100000, { message: 'Trang vượt quá giới hạn cho phép.' })
  page: number = 1;

  @ApiPropertyOptional({ type: Number, default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bài mỗi trang phải là số nguyên.' })
  @Min(1, { message: 'Số bài mỗi trang phải lớn hơn 0.' })
  @Max(50, { message: 'Số bài mỗi trang không được vượt quá 50.' })
  pageSize: number = 10;

  @ApiPropertyOptional({ maxLength: 100, example: 'example_student' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không được vượt quá 100 ký tự.' })
  q?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'Ngôn ngữ phải là chuỗi ký tự.' })
  @Matches(/^[\p{L}\p{N} ._()+#-]{1,100}$/u, { message: 'Ngôn ngữ không hợp lệ.' })
  language?: string;
}
