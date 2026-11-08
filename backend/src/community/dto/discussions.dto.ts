import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { REACTION_TYPES, type ReactionType } from '../reactions.repository.js';
import { CleanText } from './pagination.dto.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DiscussionInputDto {
  @ApiProperty({ minLength: 5, maxLength: 200 })
  @CleanText()
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự.' })
  @Length(5, 200, { message: 'Tiêu đề phải từ 5 đến 200 ký tự.' })
  title!: string;

  @ApiProperty({ minLength: 1, maxLength: 10000 })
  @CleanText()
  @IsString({ message: 'Nội dung phải là chuỗi ký tự.' })
  @Length(1, 10000, { message: 'Nội dung phải từ 1 đến 10.000 ký tự.' })
  content!: string;
}

export class CommentInputDto {
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @CleanText()
  @IsString({ message: 'Bình luận phải là chuỗi ký tự.' })
  @Length(1, 5000, { message: 'Bình luận phải từ 1 đến 5.000 ký tự.' })
  content!: string;
}

// Tạo bình luận mới; parentId (tùy chọn) là bình luận gốc được trả lời.
export class CreateCommentDto extends CommentInputDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'ID bình luận gốc được trả lời.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'Mã bình luận cần trả lời không hợp lệ.' })
  parentId?: string;
}

export class ReactionInputDto {
  @ApiProperty({ enum: REACTION_TYPES })
  @IsIn(REACTION_TYPES, { message: 'Loại cảm xúc không hợp lệ.' })
  type!: ReactionType;
}

export class DiscussionLockDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean({ message: 'Trạng thái khóa phải là true hoặc false.' })
  isLocked!: boolean;
}
