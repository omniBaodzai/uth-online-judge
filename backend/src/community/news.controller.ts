import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminListNewsQueryDto, NewsInputDto, NewsSlugParamDto, NewsStatusDto } from './dto/news.dto.js';
import { PaginationQueryDto } from './dto/pagination.dto.js';
import { NewsService } from './news.service.js';

type AdminRequest = Request & { user: { id: string; role: 'ADMIN' } };

// Công khai: chỉ đọc tin đã xuất bản. Không có guard vì không có thao tác ghi.
@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tin tức đã xuất bản' })
  list(@Query() query: PaginationQueryDto) {
    return this.news.listPublished(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết tin tức đã xuất bản' })
  get(@Param() params: NewsSlugParamDto) {
    return this.news.getPublished(params.slug);
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin/news')
export class AdminNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  list(@Query() query: AdminListNewsQueryDto) {
    return this.news.listForAdmin(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.news.getForAdmin(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() input: NewsInputDto, @Req() request: AdminRequest) {
    // Tác giả lấy từ token, bài mới luôn là bản nháp.
    return this.news.create(request.user.id, input);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: NewsInputDto) {
    return this.news.update(id, input);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() input: NewsStatusDto) {
    return this.news.setStatus(id, input.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.news.remove(id);
  }
}
