import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationContestProblemOptionsQueryDto {
  @ApiPropertyOptional({ maxLength: 100, description: 'Tìm kiếm theo mã bài hoặc tên bài.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
