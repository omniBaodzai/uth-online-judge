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
}
