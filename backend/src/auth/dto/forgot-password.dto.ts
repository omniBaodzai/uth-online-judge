import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'student@example.com', maxLength: 254 })
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
