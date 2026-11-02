import { ApiProperty } from '@nestjs/swagger';

export class ContestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  rules!: string | null;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  publicationStatus!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiProperty({ enum: ['PUBLIC', 'PRIVATE'] })
  visibility!: 'PUBLIC' | 'PRIVATE';

  @ApiProperty()
  allowRegistration!: boolean;

  @ApiProperty()
  showLeaderboard!: boolean;

  @ApiProperty({ format: 'uuid' })
  createdBy!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  publishedAt!: string | null;
}

export class ContestProblemResponseDto {
  @ApiProperty({ format: 'uuid' })
  problemId!: string;

  @ApiProperty()
  problemCode!: string;

  @ApiProperty()
  problemTitle!: string;

  @ApiProperty({ minimum: 1 })
  position!: number;

  @ApiProperty({ minimum: 0.01, maximum: 99_999_999.99 })
  maxScore!: number;

  @ApiProperty({ minimum: 0 })
  testCaseRevision!: number;
}

export class ContestListItemResponseDto extends ContestResponseDto {
  @ApiProperty({ enum: ['UPCOMING', 'ONGOING', 'ENDED', 'UNPUBLISHED'] })
  timeStatus!: 'UPCOMING' | 'ONGOING' | 'ENDED' | 'UNPUBLISHED';

  @ApiProperty({ minimum: 0 })
  problemCount!: number;

  @ApiProperty({ minimum: 0 })
  participantCount!: number;
}

export class ContestDetailResponseDto extends ContestResponseDto {
  @ApiProperty({ type: [ContestProblemResponseDto] })
  problems!: ContestProblemResponseDto[];

  @ApiProperty({ minimum: 0 })
  participantCount!: number;
}

export class ContestPageResponseDto {
  @ApiProperty({ type: [ContestListItemResponseDto] })
  items!: ContestListItemResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;
}

export class ContestOverviewResponseDto {
  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 0 })
  draft!: number;

  @ApiProperty({ minimum: 0 })
  published!: number;

  @ApiProperty({ minimum: 0 })
  archived!: number;

  @ApiProperty({ minimum: 0 })
  upcoming!: number;

  @ApiProperty({ minimum: 0 })
  ongoing!: number;

  @ApiProperty({ minimum: 0 })
  ended!: number;
}
