import { ApiProperty } from '@nestjs/swagger';

export class StudentContestSubmissionStatusCountResponseDto {
  @ApiProperty({ example: 'ACCEPTED' })
  status!: string;

  @ApiProperty({ minimum: 0, example: 12 })
  count!: number;
}

export class StudentContestProblemStatisticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  problemId!: string;

  @ApiProperty()
  problemCode!: string;

  @ApiProperty()
  problemTitle!: string;

  @ApiProperty({ minimum: 0 })
  totalSubmissions!: number;

  @ApiProperty({ minimum: 0 })
  acceptedSubmissions!: number;

  @ApiProperty({ type: [StudentContestSubmissionStatusCountResponseDto] })
  statusCounts!: StudentContestSubmissionStatusCountResponseDto[];
}

export class StudentContestLanguageStatisticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  languageId!: string;

  @ApiProperty()
  languageName!: string;

  @ApiProperty({ minimum: 0 })
  totalSubmissions!: number;

  @ApiProperty({ minimum: 0 })
  acceptedSubmissions!: number;

  @ApiProperty({ type: [StudentContestSubmissionStatusCountResponseDto] })
  statusCounts!: StudentContestSubmissionStatusCountResponseDto[];
}

export class StudentContestStatisticsResponseDto {
  @ApiProperty({ minimum: 0 })
  totalParticipants!: number;

  @ApiProperty({ minimum: 0 })
  totalProblems!: number;

  @ApiProperty({ minimum: 0 })
  totalSubmissions!: number;

  @ApiProperty({ minimum: 0 })
  acceptedSubmissions!: number;

  @ApiProperty({ minimum: 0 })
  wrongAnswerSubmissions!: number;

  @ApiProperty({ minimum: 0 })
  timeLimitSubmissions!: number;

  @ApiProperty({ minimum: 0 })
  runtimeErrorSubmissions!: number;

  @ApiProperty({
    minimum: 0,
    description: 'Submissions in PENDING, QUEUED, or RUNNING status.',
  })
  pendingSubmissions!: number;

  @ApiProperty({
    minimum: 0,
    description: 'Submission statuses other than the named summary counters.',
  })
  otherSubmissions!: number;

  @ApiProperty({ minimum: 0 })
  activeSubmitters!: number;

  @ApiProperty({ minimum: 0 })
  solvedParticipants!: number;

  @ApiProperty({
    type: [StudentContestSubmissionStatusCountResponseDto],
    description: 'Counts grouped by each actual submission status, including other verdicts.',
  })
  statusCounts!: StudentContestSubmissionStatusCountResponseDto[];

  @ApiProperty({
    type: [StudentContestProblemStatisticsResponseDto],
    description: 'Submission and status counts grouped by contest problem.',
  })
  problemStatistics!: StudentContestProblemStatisticsResponseDto[];

  @ApiProperty({
    type: [StudentContestLanguageStatisticsResponseDto],
    description: 'Submission and status counts grouped by programming language.',
  })
  languageStatistics!: StudentContestLanguageStatisticsResponseDto[];
}
