import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class ProfileUpdateDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A', maxLength: 100, nullable: true })
  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi ký tự.' })
  @MaxLength(100, { message: 'Họ tên không được vượt quá 100 ký tự.' })
  fullName?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.png',
    maxLength: 2048,
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'Đường dẫn ảnh đại diện phải là chuỗi ký tự.' })
  @MaxLength(2048, { message: 'Đường dẫn ảnh đại diện quá dài.' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Đường dẫn ảnh đại diện phải là URL HTTP hoặc HTTPS hợp lệ.' },
  )
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg', maxLength: 2048, nullable: true })
  @IsOptional()
  @IsString({ message: 'Đường dẫn ảnh bìa phải là chuỗi ký tự.' })
  @MaxLength(2048, { message: 'Đường dẫn ảnh bìa quá dài.' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Đường dẫn ảnh bìa phải là URL HTTP hoặc HTTPS hợp lệ.' },
  )
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ example: 'Sinh viên yêu thích thuật toán.', maxLength: 500, nullable: true })
  @IsOptional()
  @IsString({ message: 'Giới thiệu phải là chuỗi ký tự.' })
  @MaxLength(500, { message: 'Giới thiệu không được vượt quá 500 ký tự.' })
  bio?: string | null;

  @ApiPropertyOptional({ example: 'Đại học Giao thông vận tải TP. Hồ Chí Minh', maxLength: 160, nullable: true })
  @IsOptional()
  @IsString({ message: 'Trường hoặc tổ chức phải là chuỗi ký tự.' })
  @MaxLength(160, { message: 'Trường hoặc tổ chức không được vượt quá 160 ký tự.' })
  organization?: string | null;
}
