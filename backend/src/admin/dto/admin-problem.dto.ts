import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { AdminTestCaseDto } from './admin-test-case.dto.js';

@ValidatorConstraint({ name: 'safeProblemIllustrationUrl', async: false })
class SafeProblemIllustrationUrl implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length > 2048) return false;
    if (/^\/problems\/illustrations\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      return true;
    }
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'Đường dẫn ảnh phải là URL HTTP(S) hợp lệ hoặc ảnh đã tải lên hệ thống.';
  }
}

export class AdminProblemEditorialDto {
  @ValidateIf((editorial: AdminProblemEditorialDto) => editorial.id !== undefined)
  @IsUUID('4')
  id?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  language!: string;

  @IsString()
  @MaxLength(100_000)
  @Matches(/\S/, { message: 'Mã nguồn lời giải không được để trống.' })
  sourceCode!: string;
}

export const PROBLEM_CODE_PATTERN = /^[a-z0-9_]{1,50}$/;
export const PROBLEM_CODE_MESSAGE =
  'Mã bài chỉ được chứa chữ thường a-z, số 0-9 và dấu gạch dưới (_), tối đa 50 ký tự; không dùng chữ hoa, dấu tiếng Việt, khoảng trắng hoặc ký tự đặc biệt.';

export class AdminProblemDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Mã bài là bắt buộc.' })
  @Matches(PROBLEM_CODE_PATTERN, { message: PROBLEM_CODE_MESSAGE })
  code!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  summary?: string | null;

  @ValidateIf((_problem: AdminProblemDto, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2048)
  @Validate(SafeProblemIllustrationUrl)
  illustrationUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(25)
  @Max(100)
  illustrationWidth?: number;

  @IsOptional()
  @IsIn(['auto', '16:9', '4:3', '1:1', '3:2'])
  illustrationAspectRatio?: 'auto' | '16:9' | '4:3' | '1:1' | '3:2';

  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  illustrationAlignment?: 'left' | 'center' | 'right';

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  statement!: string;

  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: 'easy' | 'medium' | 'hard';

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  score?: number;

  @ValidateIf((problem: AdminProblemDto) => problem.testCases !== undefined)
  @IsInt()
  @Min(0)
  testCasesRevision?: number;

  @ValidateIf((problem: AdminProblemDto) => problem.testCases !== undefined)
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => AdminTestCaseDto)
  testCases?: AdminTestCaseDto[];

  @ValidateIf((problem: AdminProblemDto) => problem.editorials !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AdminProblemEditorialDto)
  editorials?: AdminProblemEditorialDto[];
}

export class AdminProblemStatusDto {
  @IsIn(['draft', 'published', 'archived'])
  status!: 'draft' | 'published' | 'archived';
}
