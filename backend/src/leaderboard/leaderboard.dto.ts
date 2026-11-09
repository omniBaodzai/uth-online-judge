import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1, maximum: 100000, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải lớn hơn 0.' })
  @Max(100000, { message: 'Trang vượt quá giới hạn cho phép.' })
  page: number = 1;

  @ApiPropertyOptional({ type: Number, default: 20, minimum: 1, maximum: 50, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số người dùng mỗi trang phải là số nguyên.' })
  @Min(1, { message: 'Số người dùng mỗi trang phải lớn hơn 0.' })
  @Max(50, { message: 'Số người dùng mỗi trang không được vượt quá 50.' })
  pageSize: number = 20;

  @ApiPropertyOptional({ maxLength: 100, example: 'example_student' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không được vượt quá 100 ký tự.' })
  q?: string;
}