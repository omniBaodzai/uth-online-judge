import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { CleanText, PaginationQueryDto } from './pagination.dto.js';

export const NEWS_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type NewsStatus = (typeof NEWS_STATUSES)[number];

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class AdminListNewsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(NEWS_STATUSES, { message: 'Trạng thái tin tức không hợp lệ.' })
  status?: NewsStatus;
}

export class NewsSlugParamDto {
  @IsString()
  @MaxLength(200, { message: 'Đường dẫn bài viết không hợp lệ.' })
  @Matches(SLUG_PATTERN, { message: 'Đường dẫn bài viết không hợp lệ.' })
  slug!: string;
}

export class NewsInputDto {
  @CleanText()
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự.' })
  @Length(3, 200, { message: 'Tiêu đề phải từ 3 đến 200 ký tự.' })
  title!: string;

  // Để trống thì hệ thống tự tạo từ tiêu đề.
  @IsOptional()
  @CleanText()
  @IsString({ message: 'Đường dẫn phải là chuỗi ký tự.' })
  @MaxLength(200, { message: 'Đường dẫn không được vượt quá 200 ký tự.' })
  @Matches(SLUG_PATTERN, {
    message: 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang (ví dụ: chao-mung-ban).',
  })
  slug?: string;

  @CleanText()
  @IsString({ message: 'Danh mục phải là chuỗi ký tự.' })
  @Length(1, 50, { message: 'Danh mục phải từ 1 đến 50 ký tự.' })
  category!: string;

  @CleanText()
  @IsString({ message: 'Tóm tắt phải là chuỗi ký tự.' })
  @Length(1, 500, { message: 'Tóm tắt phải từ 1 đến 500 ký tự.' })
  summary!: string;

  @CleanText()
  @IsString({ message: 'Nội dung phải là chuỗi ký tự.' })
  @Length(1, 50000, { message: 'Nội dung phải từ 1 đến 50.000 ký tự.' })
  content!: string;
}

export class NewsStatusDto {
  @IsIn(NEWS_STATUSES, { message: 'Trạng thái tin tức không hợp lệ.' })
  status!: NewsStatus;
}
