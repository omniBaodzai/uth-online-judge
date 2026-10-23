import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

export const PROBLEM_CODE_PATTERN = /^[a-z0-9_]{1,50}$/;
export const PROBLEM_CODE_MESSAGE =
  'Mã bài chỉ được chứa chữ thường a-z, số 0-9 và dấu gạch dưới (_), tối đa 50 ký tự; không dùng chữ hoa, dấu tiếng Việt, khoảng trắng hoặc ký tự đặc biệt.';

export class AdminExampleDto {
  @IsString()
  @MaxLength(100_000)
  input!: string;

  @IsString()
  @MaxLength(100_000)
  output!: string;
}

export class AdminProblemDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: 'Mã bài là bắt buộc.' })
  @Matches(PROBLEM_CODE_PATTERN, { message: PROBLEM_CODE_MESSAGE })
  code!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  summary?: string | null;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  statement!: string;

  @IsIn(['easy', 'medium', 'hard'])
  difficulty!: 'easy' | 'medium' | 'hard';

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tags!: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  languages!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  inputDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  outputDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  constraints?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(600)
  timeLimitSeconds!: number;

  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(65536)
  memoryLimitMb!: number;

  @IsOptional()
  @IsBoolean()
  scoringEnabled?: boolean;

  @ValidateIf((problem: AdminProblemDto) => problem.scoringEnabled === true)
  @IsDefined({ message: 'Điểm tối đa là bắt buộc khi bật tính điểm.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  score?: number;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AdminExampleDto)
  examples!: AdminExampleDto[];
}

export class AdminProblemStatusDto {
  @IsIn(['draft', 'published', 'archived'])
  status!: 'draft' | 'published' | 'archived';
}
