import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class BestSubmissionsParamsDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,50}$/, { message: 'Mã bài tập không hợp lệ.' })
  code!: string;
}

export class BestSubmissionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
