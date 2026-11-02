import { ApiProperty } from '@nestjs/swagger';

export class StudentContestLeaderboardEntryResponseDto {
  @ApiProperty({ minimum: 1, example: 1 })
  rank!: number;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ nullable: true, example: 'coder_uth' })
  username!: string | null;

  @ApiProperty({ nullable: true, example: 'https://example.com/avatar.png' })
  avatarUrl!: string | null;

  @ApiProperty({ minimum: 0, example: 100, description: 'Điểm tối đa của mỗi bài được áp dụng theo snapshot lúc nộp.' })
  totalScore!: number;

  @ApiProperty({ minimum: 0, example: 2 })
  acceptedProblems!: number;

  @ApiProperty({ minimum: 0, example: 5 })
  totalProblems!: number;

  @ApiProperty({
    minimum: 0,
    nullable: true,
    example: 1842,
    description: 'Số giây từ lúc cuộc thi bắt đầu đến lúc đạt tổng điểm tốt nhất; null khi chưa có điểm.',
  })
  elapsedSeconds!: number | null;
}

export class StudentContestLeaderboardPageResponseDto {
  @ApiProperty({ type: [StudentContestLeaderboardEntryResponseDto] })
  items!: StudentContestLeaderboardEntryResponseDto[];

  @ApiProperty({ minimum: 0, example: 42 })
  total!: number;

  @ApiProperty({ minimum: 0, example: 42, description: 'Số thí sinh đã đăng ký, không phụ thuộc bộ lọc tìm kiếm.' })
  totalParticipants!: number;

  @ApiProperty({ minimum: 1, example: 1 })
  page!: number;

  @ApiProperty({ enum: [10, 20, 50], example: 10 })
  pageSize!: number;
}
