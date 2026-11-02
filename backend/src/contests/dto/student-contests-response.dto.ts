import { ApiProperty } from '@nestjs/swagger';

export class StudentContestProblemResponseDto {
  @ApiProperty({ format: 'uuid' })
  problemId!: string;

  @ApiProperty()
  problemCode!: string;

  @ApiProperty()
  problemTitle!: string;

  @ApiProperty({ minimum: 1 })
  position!: number;

  @ApiProperty({ minimum: 0.01 })
  maxScore!: number;
}

export class StudentContestListItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ enum: ['UPCOMING', 'ONGOING', 'ENDED'] })
  timeStatus!: 'UPCOMING' | 'ONGOING' | 'ENDED';

  @ApiProperty()
  allowRegistration!: boolean;

  @ApiProperty({
    description: 'True only when registration is open and this user is not registered.',
  })
  canRegister!: boolean;

  @ApiProperty({
    description: 'True when the authenticated user has an active registration; false for guests.',
  })
  isRegistered!: boolean;

  @ApiProperty({ minimum: 0 })
  participantCount!: number;
}

export class StudentContestPageResponseDto {
  @ApiProperty({ type: [StudentContestListItemResponseDto] })
  items!: StudentContestListItemResponseDto[];

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  pageSize!: number;
}

export class StudentContestDetailResponseDto extends StudentContestListItemResponseDto {
  @ApiProperty({ nullable: true })
  rules!: string | null;

  @ApiProperty({ enum: ['REGISTERED', 'CANCELLED'], nullable: true })
  registrationStatus!: 'REGISTERED' | 'CANCELLED' | null;

  @ApiProperty({
    type: [StudentContestProblemResponseDto],
    description: 'Chỉ có dữ liệu trong thời gian thi và khi người xem đã đăng ký.',
  })
  problems!: StudentContestProblemResponseDto[];
}

export class ContestRegistrationResponseDto {
  @ApiProperty({ format: 'uuid' })
  contestId!: string;

  @ApiProperty({ enum: ['REGISTERED', 'CANCELLED'] })
  registrationStatus!: 'REGISTERED' | 'CANCELLED';

  @ApiProperty({ format: 'date-time' })
  registeredAt!: string;
}
