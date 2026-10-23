import { IsBoolean, IsString, Length } from 'class-validator';
import { CleanText } from './pagination.dto.js';

export class DiscussionInputDto {
  @CleanText()
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự.' })
  @Length(5, 200, { message: 'Tiêu đề phải từ 5 đến 200 ký tự.' })
  title!: string;

  @CleanText()
  @IsString({ message: 'Nội dung phải là chuỗi ký tự.' })
  @Length(1, 10000, { message: 'Nội dung phải từ 1 đến 10.000 ký tự.' })
  content!: string;
}

export class CommentInputDto {
  @CleanText()
  @IsString({ message: 'Bình luận phải là chuỗi ký tự.' })
  @Length(1, 5000, { message: 'Bình luận phải từ 1 đến 5.000 ký tự.' })
  content!: string;
}

export class DiscussionLockDto {
  @IsBoolean({ message: 'Trạng thái khóa phải là true hoặc false.' })
  isLocked!: boolean;
}
