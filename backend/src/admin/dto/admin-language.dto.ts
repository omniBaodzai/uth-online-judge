import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddJudge0LanguageDto {
  @ApiProperty({
    type: Number,
    minimum: 1,
    maximum: 100000,
    description: 'ID Judge0 hợp lệ do cấu hình ngôn ngữ cung cấp.',
  })
  @Type(() => Number)
  @IsInt({ message: 'Mã ngôn ngữ Judge0 phải là số nguyên.' })
  @Min(1, { message: 'Mã ngôn ngữ Judge0 không hợp lệ.' })
  @Max(100_000, { message: 'Mã ngôn ngữ Judge0 không hợp lệ.' })
  judge0LanguageId!: number;
}
