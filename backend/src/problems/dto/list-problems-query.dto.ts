import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PROBLEM_SORT_FIELDS,
  USER_PROBLEM_STATUSES,
  type ProblemSortField,
  type UserProblemStatus,
} from '../problems.types.js';

const toTagList = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : value;

export class ListProblemsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên.' })
  @Min(1, { message: 'Số trang phải lớn hơn hoặc bằng 1.' })
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Kích thước trang phải là số nguyên.' })
  @Min(1, { message: 'Kích thước trang phải từ 1 đến 50.' })
  @Max(50, { message: 'Kích thước trang phải từ 1 đến 50.' })
  pageSize: number = 20;

  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc mã bài tập', maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không được vượt quá 100 ký tự.' })
  search?: string;

  @ApiPropertyOptional({ description: 'Danh sách slug chủ đề, phân tách bằng dấu phẩy', example: 'math,arrays' })
  @IsOptional()
  @Transform(toTagList)
  @IsArray({ message: 'Danh sách chủ đề không hợp lệ.' })
  @ArrayMaxSize(10, { message: 'Chỉ được lọc tối đa 10 chủ đề.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { each: true, message: 'Slug chủ đề không hợp lệ.' })
  @MaxLength(120, { each: true, message: 'Slug chủ đề quá dài.' })
  tags?: string[];

  @ApiPropertyOptional({ enum: USER_PROBLEM_STATUSES })
  @IsOptional()
  @IsIn(USER_PROBLEM_STATUSES, { message: 'Trạng thái lọc không hợp lệ.' })
  status?: UserProblemStatus;

  @ApiPropertyOptional({ enum: PROBLEM_SORT_FIELDS, default: 'code' })
  @IsOptional()
  @IsIn(PROBLEM_SORT_FIELDS, { message: 'Trường sắp xếp không hợp lệ.' })
  sort: ProblemSortField = 'code';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Thứ tự sắp xếp không hợp lệ.' })
  order: 'asc' | 'desc' = 'asc';
}
