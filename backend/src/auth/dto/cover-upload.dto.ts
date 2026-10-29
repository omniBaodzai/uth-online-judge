import { Transform, Type } from 'class-transformer';
import { IsNumber, IsObject, Max, Min, ValidateNested } from 'class-validator';

export class CoverCropMetadataDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  x!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  y!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  width!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  height!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20000)
  sourceWidth!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20000)
  sourceHeight!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(10)
  aspect!: number;
}

export class CoverUploadDto {
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