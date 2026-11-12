import { IsDefined, IsIn, IsObject, IsOptional, IsString, Length, Matches, MaxLength, Validate, ValidateIf } from 'class-validator';
import { CleanText, PaginationQueryDto } from './pagination.dto.js';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  NEWS_RICH_CONTENT_FORMAT,
  NewsRichDocumentConstraint,
  type NewsContentFormat,
  type NewsRichDocument,
} from '../news-rich-content.js';

export const NEWS_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type NewsStatus = (typeof NEWS_STATUSES)[number];
export const NEWS_CONTENT_FORMATS = ['markdown', NEWS_RICH_CONTENT_FORMAT] as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class AdminListNewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NEWS_STATUSES })
  @IsOptional()
  @IsIn(NEWS_STATUSES, { message: 'Trạng thái tin tức không hợp lệ.' })
  status?: NewsStatus;
}

export class NewsSlugParamDto {
  @ApiProperty({ maxLength: 200, pattern: SLUG_PATTERN.source })
  @IsString()
  @MaxLength(200, { message: 'Đường dẫn bài viết không hợp lệ.' })
  @Matches(SLUG_PATTERN, { message: 'Đường dẫn bài viết không hợp lệ.' })
  slug!: string;
}

export class NewsInputDto {
  @ApiProperty({ minLength: 3, maxLength: 200 })
  @CleanText()
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự.' })
  @Length(3, 200, { message: 'Tiêu đề phải từ 3 đến 200 ký tự.' })
  title!: string;

  // Để trống thì hệ thống tự tạo từ tiêu đề.
  @ApiPropertyOptional({ maxLength: 200, pattern: SLUG_PATTERN.source })
  @IsOptional()
  @CleanText()
  @IsString({ message: 'Đường dẫn phải là chuỗi ký tự.' })
  @MaxLength(200, { message: 'Đường dẫn không được vượt quá 200 ký tự.' })
  @Matches(SLUG_PATTERN, {
    message: 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang (ví dụ: chao-mung-ban).',
  })
  slug?: string;

  @ApiProperty({ minLength: 1, maxLength: 50 })
  @CleanText()
  @IsString({ message: 'Danh mục phải là chuỗi ký tự.' })
  @Length(1, 50, { message: 'Danh mục phải từ 1 đến 50 ký tự.' })
  category!: string;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  @CleanText()
  @IsString({ message: 'Tóm tắt phải là chuỗi ký tự.' })
  @Length(1, 500, { message: 'Tóm tắt phải từ 1 đến 500 ký tự.' })
  summary!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 50000, description: 'Bắt buộc với Markdown; với Rich Text do backend sinh từ contentJson.' })
  @ValidateIf((input: NewsInputDto) => input.contentFormat !== NEWS_RICH_CONTENT_FORMAT)
  @CleanText()
  @IsString({ message: 'Nội dung phải là chuỗi ký tự.' })
  @Length(1, 50000, { message: 'Nội dung phải từ 1 đến 50.000 ký tự.' })
  content!: string;

  @ApiPropertyOptional({ enum: NEWS_CONTENT_FORMATS, default: 'markdown' })
  @IsOptional()
  @IsIn(NEWS_CONTENT_FORMATS, { message: 'Định dạng nội dung không hợp lệ.' })
  contentFormat?: NewsContentFormat;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Rich Text envelope format uth-news-rich-text, version 1. Chỉ bắt buộc khi contentFormat=tiptap-json.',
  })
  @ValidateIf((input: NewsInputDto) => input.contentFormat === NEWS_RICH_CONTENT_FORMAT)
  @IsDefined({ message: 'Nội dung Rich Text là bắt buộc.' })
  @IsObject({ message: 'Nội dung Rich Text phải là một document JSON.' })
  @Validate(NewsRichDocumentConstraint, {
    message: 'Cấu trúc Rich Text không hợp lệ hoặc chứa thuộc tính không được hỗ trợ.',
  })
  contentJson?: NewsRichDocument;
}

export class NewsPatchDto extends PartialType(NewsInputDto, { skipNullProperties: false }) {}

export class NewsStatusDto {
  @ApiProperty({ enum: NEWS_STATUSES })
  @IsIn(NEWS_STATUSES, { message: 'Trạng thái tin tức không hợp lệ.' })
  status!: NewsStatus;
}
