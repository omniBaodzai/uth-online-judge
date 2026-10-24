import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AdminTestCaseDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(100_000)
  input!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  expectedOutput!: string;

  @IsOptional()
  @IsIn(['sample', 'hidden'])
  kind!: 'sample' | 'hidden';

  @IsOptional()
  @IsIn([1])
  points?: number;
}

export class AdminTestCaseCollectionDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => AdminTestCaseDto)
  testCases!: AdminTestCaseDto[];
}
