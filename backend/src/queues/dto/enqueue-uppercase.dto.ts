import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class EnqueueUppercaseDto {
  @ApiProperty({ example: 'hello uth', minLength: 1, maxLength: 200 })
  @IsString({ message: 'Text must be a string.' })
  @MinLength(1, { message: 'Text must not be empty.' })
  @MaxLength(200, { message: 'Text must not exceed 200 characters.' })
  text!: string;
}
