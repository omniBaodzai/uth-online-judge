import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class VerifyResetOtpDto {
  @ApiProperty({ example: 'student@example.com', maxLength: 254 })
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: '482916', minLength: 6, maxLength: 6 })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}
