import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { StudentContestParticipantsQuery } from '../student-contests.types.js';

export class StudentContestParticipantsQueryDto
  implements StudentContestParticipantsQuery
{
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @ApiPropertyOptional({ enum: [10, 20, 50], default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([10, 20, 50])
  pageSize: 10 | 20 | 50 = 10;

  @ApiPropertyOptional({ maxLength: 100, description: 'Tìm username không phân biệt hoa/thường.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ['all', 'registered', 'participated'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'registered', 'participated'])
  status: StudentContestParticipantsQuery['status'] = 'all';
}

export class StudentContestParticipantResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ format: 'date-time' })
  registeredAt!: string;

  @ApiProperty({ enum: ['registered', 'participated'] })
  status!: 'registered' | 'participated';
}

export class StudentContestParticipantsPageResponseDto {
  @ApiProperty({ type: [StudentContestParticipantResponseDto] })
  items!: StudentContestParticipantResponseDto[];

  @ApiProperty({ minimum: 0, description: 'Total matching the search and status filter.' })
  total!: number;

  @ApiProperty({ minimum: 0, description: 'All currently registered participants, independent of filters.' })
  participantCount!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ enum: [10, 20, 50] })
  pageSize!: number;
}
