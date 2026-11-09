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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminTestCaseDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'ID của test case hiện có khi cập nhật.' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ maxLength: 100_000 })
  @IsString()
  @MaxLength(100_000)
  input!: string;

  @ApiProperty({ minLength: 1, maxLength: 100_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  expectedOutput!: string;

  @ApiPropertyOptional({ enum: ['sample', 'hidden'] })
  @IsOptional()
  @IsIn(['sample', 'hidden'])
  kind!: 'sample' | 'hidden';

  @ApiPropertyOptional({ enum: [1] })
  @IsOptional()
  @IsIn([1])
  points?: number;
}

export class AdminTestCaseCollectionDto {
  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @ApiProperty({ type: () => [AdminTestCaseDto], maxItems: 1000 })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => AdminTestCaseDto)
  testCases!: AdminTestCaseDto[];
}
