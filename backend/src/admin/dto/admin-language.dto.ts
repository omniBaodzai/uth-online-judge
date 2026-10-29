import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class AddJudge0LanguageDto {
  @Type(() => Number)
  @IsInt({ message: 'Mã ngôn ngữ Judge0 phải là số nguyên.' })
  @Min(1, { message: 'Mã ngôn ngữ Judge0 không hợp lệ.' })
  @Max(100_000, { message: 'Mã ngôn ngữ Judge0 không hợp lệ.' })
  judge0LanguageId!: number;
}
