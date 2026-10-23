import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const MAX_SOURCE_CODE_LENGTH = 65536;

export class CreateSubmissionDto {
  @ApiProperty({ example: 'UTH001', maxLength: 30 })
  @IsString({ message: 'Mã bài tập phải là chuỗi ký tự.' })
  @Matches(/^[A-Za-z0-9_-]{1,30}$/, { message: 'Mã bài tập không hợp lệ.' })
  problemCode!: string;

  @ApiProperty({ example: 'cpp', description: 'Slug của ngôn ngữ trong bảng programming_languages' })
  @IsString({ message: 'Ngôn ngữ phải là chuỗi ký tự.' })
  @Matches(/^[a-z0-9][a-z0-9+#._-]{0,99}$/, { message: 'Ngôn ngữ không hợp lệ.' })
  language!: string;

  @ApiProperty({ maxLength: MAX_SOURCE_CODE_LENGTH })
  @IsString({ message: 'Mã nguồn phải là chuỗi ký tự.' })
  @MinLength(1, { message: 'Vui lòng nhập mã nguồn.' })
  @MaxLength(MAX_SOURCE_CODE_LENGTH, {
    message: `Mã nguồn không được vượt quá ${MAX_SOURCE_CODE_LENGTH} ký tự.`,
  })
  sourceCode!: string;
}
