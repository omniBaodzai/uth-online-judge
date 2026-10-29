import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'student01', minLength: 3, maxLength: 32 })
  @IsString({ message: 'Tên đăng nhập phải là chuỗi ký tự.' })
  @MinLength(3, { message: 'Tên đăng nhập phải có ít nhất 3 ký tự.' })
  @MaxLength(32, { message: 'Tên đăng nhập không được vượt quá 32 ký tự.' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'Tên đăng nhập chỉ được gồm chữ cái không dấu, số, dấu chấm, gạch dưới và gạch ngang; không được chứa @.',
  })
  username!: string;

  @ApiProperty({ example: 'student@example.com', maxLength: 254 })
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  @MaxLength(254, { message: 'Email không được vượt quá 254 ký tự.' })
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72, format: 'password' })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  @MaxLength(72, { message: 'Mật khẩu không được vượt quá 72 ký tự.' })
  password!: string;
}
