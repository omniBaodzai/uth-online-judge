import { Transform } from 'class-transformer';
import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class AdminSolutionDto {
  // Chuỗi rỗng nghĩa là xóa lời giải.
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : value))
  @IsString()
  @MaxLength(100_000)
  content!: string;

  @IsBoolean()
  published!: boolean;
}
