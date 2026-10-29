import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { BestSubmissionsRepository } from './best-submissions.repository.js';
import { BestSubmissionsParamsDto, BestSubmissionsQueryDto } from './dto/best-submissions.dto.js';

@ApiTags('Submissions')
@Controller('problems')
export class BestSubmissionsController {
  constructor(private readonly repository: BestSubmissionsRepository) {}

  @Get(':code/submissions/best')
  @ApiOperation({ summary: 'Bài nộp ACCEPTED tốt nhất của từng người dùng cho một bài tập (không gồm mã nguồn)' })
  async list(@Param() params: BestSubmissionsParamsDto, @Query() query: BestSubmissionsQueryDto) {
    const problem = await this.repository.findPublishedProblem(params.code);
    if (!problem) throw new NotFoundException('Không tìm thấy bài tập.');
    return this.repository.findPage(problem, query.page, query.pageSize);
  }

  @Get(':code/submissions/best/:submissionId/source')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mã nguồn của một bài nộp nằm trong danh sách bài nộp tốt nhất (cần đăng nhập)' })
  async source(
    @Param() params: BestSubmissionsParamsDto,
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
  ) {
    const problem = await this.repository.findPublishedProblem(params.code);
    if (!problem) throw new NotFoundException('Không tìm thấy bài tập.');
    const source = await this.repository.findSource(problem.id, submissionId);
    if (!source) throw new NotFoundException('Không tìm thấy bài nộp.');
    return source;
  }
}
