import { Transform, Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  isUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CleanText, PaginationQueryDto } from '../community/dto/pagination.dto.js';

export const CONTACT_MESSAGE_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED'] as const;
export type ContactMessageStatus = (typeof CONTACT_MESSAGE_STATUSES)[number];
export type ContactReplySenderRole = 'ADMIN' | 'USER';

export class CreateContactMessageDto {
  @ApiProperty({ example: 'Nguyen Van A', maxLength: 100 })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ và tên.' })
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: 'student@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replaceAll(String.fromCharCode(0), '').trim() : value,
  )
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Khong the nop bai Java', maxLength: 120 })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề.' })
  @MaxLength(120)
  subject!: string;

  @ApiProperty({ example: 'Toi gap loi khi nop bai...', maxLength: 2000 })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung yêu cầu.' })
  @MaxLength(2000)
  content!: string;
}

export class ContactReplyDto {
  @ApiProperty({ example: 'Chung toi da ghi nhan yeu cau cua ban.', maxLength: 5000 })
  @CleanText()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung phản hồi.' })
  @MaxLength(5000)
  content!: string;
}

export class UpdateContactMessageStatusDto {
  @ApiProperty({ enum: CONTACT_MESSAGE_STATUSES })
  @IsIn(CONTACT_MESSAGE_STATUSES, { message: 'Trạng thái yêu cầu không hợp lệ.' })
  status!: ContactMessageStatus;
}

export class ListContactMessagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CONTACT_MESSAGE_STATUSES })
  @IsOptional()
  @IsIn(CONTACT_MESSAGE_STATUSES, { message: 'Trạng thái lọc không hợp lệ.' })
  status?: ContactMessageStatus;
}

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}

export function validateIdempotencyKey(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null;
  const key = value.trim();
  if (!isUUID(key, '4')) {
    throw new BadRequestException('Idempotency-Key phải là UUID v4.');
  }
  return key;
}
