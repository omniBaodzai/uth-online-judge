import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { SUBMISSION_STATUSES } from './problem-submissions.dto.js';

export class GlobalSubmissionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải lớn hơn 0.' })
  @Max(100000, { message: 'Trang vượt quá giới hạn cho phép.' })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bài mỗi trang phải là số nguyên.' })
  @Min(1, { message: 'Số bài mỗi trang phải lớn hơn 0.' })
  @Max(50, { message: 'Số bài mỗi trang không được vượt quá 50.' })
  pageSize = 10;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không được vượt quá 100 ký tự.' })
  q?: string;

  @IsOptional()
  @IsIn(SUBMISSION_STATUSES, { message: 'Trạng thái bài nộp không hợp lệ.' })
  status?: (typeof SUBMISSION_STATUSES)[number];

  @IsOptional()
  @IsString({ message: 'Ngôn ngữ phải là chuỗi ký tự.' })
  @Matches(/^[\p{L}\p{N} ._()+#-]{1,100}$/u, { message: 'Ngôn ngữ không hợp lệ.' })
  language?: string;
}
