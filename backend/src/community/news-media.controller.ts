import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type {} from 'multer';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DocumentControllerOperations } from '../swagger/document-controller-operations.decorator.js';
import { NEWS_MEDIA_MAX_BYTES, NewsMediaService } from './news-media.service.js';

type AdminRequest = Request & { user: { id: string; role: 'ADMIN' } };

function mediaResponse(
  media: { image: Buffer; contentType: string },
  response: Response,
): StreamableFile {
  response.set({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
  });
  return new StreamableFile(media.image, {
    type: media.contentType,
    length: media.image.length,
    disposition: 'inline',
  });
}

@ApiTags('Admin')
@DocumentControllerOperations()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin/news/media')
export class AdminNewsMediaController {
  constructor(private readonly media: NewsMediaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Tải ảnh cho nội dung tin tức',
    description: 'Chỉ quản trị viên; chấp nhận PNG, JPEG và WebP tối đa 5 MiB.',
  })
  @ApiCreatedResponse({ description: 'Ảnh đã được chuẩn hóa và lưu dưới dạng media tin tức.' })
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: NEWS_MEDIA_MAX_BYTES, files: 1 },
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AdminRequest,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh tin tức.');
    return this.media.upload(file.buffer, request.user.id);
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return mediaResponse(await this.media.findForAdmin(id), response);
  }
}

@ApiTags('News')
@DocumentControllerOperations()
@Controller('news/media')
export class NewsMediaController {
  constructor(private readonly media: NewsMediaService) {}

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return mediaResponse(await this.media.findPublished(id), response);
  }
}
