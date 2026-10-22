import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ChangeRoleDto {
  @IsIn(['ADMIN', 'MODERATOR', 'USER'])
  role!: 'ADMIN' | 'MODERATOR' | 'USER';
}

export class SetStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class TestCaseDto {
  @IsString()
  @MaxLength(1_000_000)
  input!: string;

  @IsString()
  @MaxLength(1_000_000)
  expectedOutput!: string;

  @IsOptional()
  @IsBoolean()
  isSample?: boolean;
}

export class ProblemDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,30}$/, { message: 'Mã bài chỉ gồm chữ, số, gạch ngang/dưới (2-30 ký tự).' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(30)
  timeLimitSeconds!: number;

  @IsInt()
  @Min(16)
  @Max(2048)
  memoryLimitMb!: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  totalScore!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases?: TestCaseDto[];
}

export class ModerateDto {
  @IsIn(['PENDING', 'APPROVED', 'HIDDEN'])
  status!: 'PENDING' | 'APPROVED' | 'HIDDEN';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class TicketUpdateDto {
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reply?: string;
}

export class FeatureFlagsDto {
  @IsBoolean() submissions!: boolean;
  @IsBoolean() contests!: boolean;
  @IsBoolean() organizations!: boolean;
  @IsBoolean() comments!: boolean;
  @IsBoolean() registration!: boolean;
}

export class SettingsDto {
  @IsString() @MinLength(1) @MaxLength(80) appName!: string;
  @IsString() @MaxLength(255) smtpHost!: string;
  @IsInt() @Min(1) @Max(65535) smtpPort!: number;
  @IsBoolean() smtpSecure!: boolean;
  @IsString() @MaxLength(255) smtpUser!: string;
  @IsString() @MaxLength(255) smtpFrom!: string;
  @IsInt() @Min(1) @Max(50) maxUploadMb!: number;

  @ValidateNested()
  @Type(() => FeatureFlagsDto)
  features!: FeatureFlagsDto;

  // Chỉ ghi; không bao giờ trả lại qua API.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpPassword?: string;
}

export class ImportCsvDto {
  @IsIn(['problems', 'test_cases'])
  table!: 'problems' | 'test_cases';

  @IsString()
  @MaxLength(5_000_000)
  csv!: string;
}

export class RestoreDto {
  @IsIn(['RESTORE'], { message: 'Nhập chính xác RESTORE để xác nhận.' })
  confirm!: string;
}

export class ClientErrorDto {
  @IsString() @MaxLength(2000) message!: string;
  @IsOptional() @IsString() @MaxLength(8000) stack?: string;
  @IsOptional() @IsString() @MaxLength(500) path?: string;
  @IsOptional() @IsIn(['ERROR', 'WARN']) level?: 'ERROR' | 'WARN';
}

export class CreateTicketDto {
  @IsString() @MinLength(3) @MaxLength(200) subject!: string;
  @IsString() @MinLength(5) @MaxLength(4000) message!: string;
  @IsOptional() @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export class CreateContributionDto {
  @IsIn(['COMMENT', 'BLOG', 'SOLUTION'])
  kind!: 'COMMENT' | 'BLOG' | 'SOLUTION';

  @IsOptional() @IsString() @MaxLength(30) problemCode?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsString() @MinLength(2) @MaxLength(10000) body!: string;
}
