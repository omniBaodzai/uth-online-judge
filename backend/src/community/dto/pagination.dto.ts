import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Loại bỏ ký tự NUL (PostgreSQL từ chối) và khoảng trắng thừa ở hai đầu.
export const CleanText = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(String.fromCharCode(0)).join('').trim() : value,
  );

export class PaginationQueryDto {
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
  @IsInt({ message: 'Số mục mỗi trang phải là số nguyên.' })
  @Min(1, { message: 'Số mục mỗi trang phải lớn hơn 0.' })
  @Max(50, { message: 'Số mục mỗi trang không được vượt quá 50.' })
  pageSize: number = 10;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @CleanText()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không được vượt quá 100 ký tự.' })
  q?: string;
}
