import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const SOURCE_CODE_MAX_LENGTH = 100_000;

export class CreateSubmissionDto {
  @ApiProperty({ example: 'UTH001', maxLength: 30 })
  @IsString({ message: 'Mã bài tập phải là chuỗi ký tự.' })
  @Matches(/^[A-Za-z0-9_-]{1,30}$/, { message: 'Mã bài tập không hợp lệ.' })
  problemCode!: string;

  @ApiProperty({ maxLength: SOURCE_CODE_MAX_LENGTH })
  @IsString({ message: 'Mã nguồn phải là chuỗi ký tự.' })
  @MinLength(1, { message: 'Vui lòng nhập mã nguồn.' })
  @MaxLength(SOURCE_CODE_MAX_LENGTH, { message: 'Mã nguồn quá dài.' })
  sourceCode!: string;

  @ApiPropertyOptional({ example: 54, description: 'language_id của Judge0' })
  @IsOptional()
  @IsInt({ message: 'languageId phải là số nguyên.' })
  languageId?: number;

  @ApiPropertyOptional({ example: 'C++20', description: 'Tên ngôn ngữ, dùng khi không gửi languageId' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  language?: string;
}
