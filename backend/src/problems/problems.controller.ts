import { Controller, Get, Param, ParseUUIDPipe, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import { ListProblemsQueryDto } from './dto/list-problems-query.dto.js';
import { ProblemsService } from './problems.service.js';
import { ProblemIllustrationService } from './problem-illustration.service.js';

type MaybeAuthenticatedRequest = Request & { user?: { id: string } | null };
type AuthenticatedRequest = Request & { user: { id: string } };

@ApiTags('Problems')
@Controller('problems')
export class ProblemsController {
  constructor(
    private readonly problems: ProblemsService,
    private readonly illustrations: ProblemIllustrationService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Danh sách bài tập đã xuất bản (có phân trang, lọc, sắp xếp)' })
  @ApiOkResponse({ description: 'Danh sách bài tập và thông tin phân trang' })
  list(@Query() query: ListProblemsQueryDto, @Req() request: MaybeAuthenticatedRequest) {
    return this.problems.list(query, request.user?.id ?? null);
  }

  // Khai báo trước ':code' để 'tags' không bị hiểu là mã bài tập.
  @Get('tags')
  @ApiOperation({ summary: 'Danh sách chủ đề dùng để lọc bài tập' })
  tags() {
    return this.problems.listTags();
  }

  @Get('illustrations/:id')
  @ApiOperation({ summary: 'Lấy ảnh minh họa công khai của bài tập' })
  async illustration(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res() response: Response,
  ) {
    const asset = await this.illustrations.find(id);
    response
      .set('Content-Type', asset.contentType)
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .set('X-Content-Type-Options', 'nosniff')
      .send(asset.image);
  }

  @Get(':code')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Chi tiết một bài tập đã xuất bản theo mã bài' })
  @ApiOkResponse({ description: 'Chi tiết bài tập (không gồm test case ẩn)' })
  detail(@Param('code') code: string, @Req() request: MaybeAuthenticatedRequest) {
    return this.problems.getByCode(code, request.user?.id ?? null);
  }

  @Get(':code/solution')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem lời giải sau khi đã có ít nhất một kết quả chấm cuối cùng' })
  @ApiOkResponse({ description: 'Thông tin bài tập và các lời giải đã xuất bản' })
  editorial(@Param('code') code: string, @Req() request: AuthenticatedRequest) {
    return this.problems.getEditorial(code, request.user.id);
  }
}
