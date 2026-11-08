import { Transform, Type } from 'class-transformer';
import { IsNumber, IsObject, Max, Min, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CoverCropMetadataDto {
  @ApiProperty({ type: Number, minimum: 0, example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  x!: number;

  @ApiProperty({ type: Number, minimum: 0, example: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  y!: number;

  @ApiProperty({ type: Number, minimum: 1, example: 800 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  width!: number;

  @ApiProperty({ type: Number, minimum: 1, example: 400 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  height!: number;

  @ApiProperty({ type: Number, minimum: 1, maximum: 20000, example: 1600 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20000)
  sourceWidth!: number;

  @ApiProperty({ type: Number, minimum: 1, maximum: 20000, example: 900 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20000)
  sourceHeight!: number;

  @ApiProperty({ type: Number, minimum: 0.1, maximum: 10, example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(10)
  aspect!: number;
}

export class CoverUploadDto {
  @ApiProperty({ type: () => CoverCropMetadataDto })
  @Transform(({ value }: { value: unknown }) => {
    let metadata = value;
    if (typeof value === 'string') {
      try {
        metadata = JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
      return metadata;
    }
    return Object.assign(new CoverCropMetadataDto(), metadata);
  })
  @IsObject({ message: 'Thông số cắt ảnh bìa không hợp lệ.' })
  @ValidateNested()
  crop!: CoverCropMetadataDto;
}