import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { AdminDifficulty, AdminProblemStatus } from '../admin.types.js';

export class ListAdminProblemsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: AdminProblemStatus;

  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: AdminDifficulty;
}
