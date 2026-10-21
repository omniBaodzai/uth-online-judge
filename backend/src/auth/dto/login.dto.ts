import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'student01 or student@example.com', maxLength: 254 })
  @IsString({ message: 'Tên đăng nhập hoặc email phải là chuỗi ký tự.' })
  @MinLength(1, { message: 'Vui lòng nhập tên đăng nhập hoặc email.' })
  @MaxLength(254, {
    message: 'Tên đăng nhập hoặc email không được vượt quá 254 ký tự.',
  })
  identifier!: string;

  @ApiProperty({ minLength: 1, maxLength: 72, format: 'password' })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu.' })
  @MaxLength(72, { message: 'Mật khẩu không được vượt quá 72 ký tự.' })
  password!: string;
}
