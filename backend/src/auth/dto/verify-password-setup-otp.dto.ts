import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyPasswordSetupOtpDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  transactionId!: string;

  @ApiProperty({ example: '482916', minLength: 6, maxLength: 6 })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}
