import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ format: 'password', maxLength: 72 })
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu hiện tại.' })
  @MaxLength(72, { message: 'Mật khẩu hiện tại không được vượt quá 72 ký tự.' })
  currentPassword!: string;

  @ApiProperty({ format: 'password', minLength: 8, maxLength: 72 })
  @IsString({ message: 'Mật khẩu mới phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu mới.' })
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' })
  @MaxLength(72, { message: 'Mật khẩu mới không được vượt quá 72 ký tự.' })
  newPassword!: string;
}
