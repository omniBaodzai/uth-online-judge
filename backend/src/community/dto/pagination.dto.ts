import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Loại bỏ ký tự NUL (PostgreSQL từ chối) và khoảng trắng thừa ở hai đầu.
export const CleanText = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(String.fromCharCode(0)).join('').trim() : value,
  );

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải lớn hơn 0.' })
  @Max(100000, { message: 'Trang vượt quá giới hạn cho phép.' })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số mục mỗi trang phải là số nguyên.' })
  @Min(1, { message: 'Số mục mỗi trang phải lớn hơn 0.' })
  @Max(50, { message: 'Số mục mỗi trang không được vượt quá 50.' })
  pageSize = 10;

  @IsOptional()
  @CleanText()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không được vượt quá 100 ký tự.' })
  q?: string;
}
