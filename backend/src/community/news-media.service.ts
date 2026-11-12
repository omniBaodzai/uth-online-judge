import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import sharp from 'sharp';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';

export const NEWS_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const NEWS_MEDIA_MAX_DIMENSION = 12_000;
export const NEWS_MEDIA_MAX_PIXELS = 16_000_000;
export const NEWS_MEDIA_ORPHAN_RETENTION_DAYS = 7;
const NEWS_MEDIA_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

type NewsImageFormat = {
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  sharpFormat: 'png' | 'jpeg' | 'webp';
};

export type NewsMediaAsset = {
  id: string;
  url: string;
  contentType: NewsImageFormat['contentType'];
  byteSize: number;
  width: number;
  height: number;
};

export type NewsMediaContent = {
  image: Buffer;
  contentType: NewsImageFormat['contentType'];
};

function detectNewsImageFormat(buffer: Buffer): NewsImageFormat | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { contentType: 'image/png', sharpFormat: 'png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: 'image/jpeg', sharpFormat: 'jpeg' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { contentType: 'image/webp', sharpFormat: 'webp' };
  }
  return null;
}

@Injectable()
export class NewsMediaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsMediaService.name);
  private cleanupTimer: NodeJS.Timeout | undefined;
  private cleanupInProgress = false;

  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      void this.cleanupOrphans().catch((error: unknown) => {
        this.logger.error('Scheduled news media orphan cleanup failed.', error instanceof Error ? error.stack : undefined);
      });
    }, NEWS_MEDIA_CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
    void this.cleanupOrphans().catch((error: unknown) => {
      this.logger.warn(
        `Initial news media cleanup is unavailable; migration 027 may not be applied yet. ${
          error instanceof Error ? error.message : 'Unknown database error.'
        }`,
      );
    });
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async upload(buffer: Buffer, uploadedBy: string): Promise<NewsMediaAsset> {
    if (buffer.length === 0 || buffer.length > NEWS_MEDIA_MAX_BYTES) {
      throw new BadRequestException('Ảnh tin tức phải có dung lượng từ 1 byte đến 5 MiB.');
    }

    const format = detectNewsImageFormat(buffer);
    if (!format) {
      throw new BadRequestException('Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP đúng định dạng.');
    }

    let image: Buffer;
    let width: number;
    let height: number;
    try {
      const pipeline = sharp(buffer, {
        failOn: 'error',
        limitInputPixels: NEWS_MEDIA_MAX_PIXELS,
        sequentialRead: true,
      }).rotate();
      const metadata = await pipeline.metadata();
      if (
        metadata.format !== format.sharpFormat ||
        metadata.pages !== undefined && metadata.pages > 1 ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > NEWS_MEDIA_MAX_DIMENSION ||
        metadata.height > NEWS_MEDIA_MAX_DIMENSION ||
        metadata.width * metadata.height > NEWS_MEDIA_MAX_PIXELS
      ) {
        throw new BadRequestException('Ảnh tin tức không hợp lệ hoặc vượt quá giới hạn kích thước 12.000 px / 16 megapixel.');
      }

      const encoded = await pipeline
        .toFormat(format.sharpFormat, format.sharpFormat === 'jpeg'
          ? { quality: 90 }
          : format.sharpFormat === 'webp'
            ? { quality: 90 }
            : { compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
      image = encoded.data;
      width = encoded.info.width;
      height = encoded.info.height;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Tệp ảnh bị lỗi hoặc không thể giải mã. Hãy xuất lại ảnh PNG, JPEG hoặc WebP.');
    }

    if (
      image.length === 0 ||
      image.length > NEWS_MEDIA_MAX_BYTES ||
      width > NEWS_MEDIA_MAX_DIMENSION ||
      height > NEWS_MEDIA_MAX_DIMENSION ||
      width * height > NEWS_MEDIA_MAX_PIXELS
    ) {
      throw new BadRequestException('Ảnh sau khi xử lý vượt quá giới hạn dung lượng hoặc kích thước cho phép.');
    }

    const result = await this.database.query<{ id: string }>(
      `INSERT INTO public.news_media
         (image_data, content_type, byte_size, width, height, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [image, format.contentType, image.length, width, height, uploadedBy],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('News media insert did not return an id');

    return {
      id,
      url: `/news/media/${id}`,
      contentType: format.contentType,
      byteSize: image.length,
      width,
      height,
    };
  }

  async findForAdmin(id: string): Promise<NewsMediaContent> {
    const result = await this.database.query<{ image_data: Buffer; content_type: NewsMediaContent['contentType'] }>(
      `SELECT image_data, content_type
       FROM public.news_media
       WHERE id = $1`,
      [id],
    );
    const media = result.rows[0];
    if (!media) throw new NotFoundException('Không tìm thấy ảnh tin tức.');
    return { image: media.image_data, contentType: media.content_type };
  }

  async findPublished(id: string): Promise<NewsMediaContent> {
    const result = await this.database.query<{ image_data: Buffer; content_type: NewsMediaContent['contentType'] }>(
      `SELECT media.image_data, media.content_type
       FROM public.news_media AS media
       WHERE media.id = $1
         AND EXISTS (
           SELECT 1
           FROM public.news_article_media AS reference
           INNER JOIN public.news_articles AS article ON article.id = reference.news_article_id
           WHERE reference.news_media_id = media.id
             AND article.status = 'PUBLISHED'
         )`,
      [id],
    );
    const media = result.rows[0];
    if (!media) throw new NotFoundException('Không tìm thấy ảnh tin tức đã xuất bản.');
    return { image: media.image_data, contentType: media.content_type };
  }

  async cleanupOrphans(): Promise<number> {
    if (this.cleanupInProgress) return 0;
    this.cleanupInProgress = true;
    try {
      const result = await this.database.query(
        `WITH expired AS (
           SELECT media.id
           FROM public.news_media AS media
           WHERE media.orphaned_at < NOW() - ($1::int * INTERVAL '1 day')
             AND NOT EXISTS (
               SELECT 1
               FROM public.news_article_media AS reference
               WHERE reference.news_media_id = media.id
             )
           ORDER BY media.orphaned_at, media.id
           LIMIT 100
           FOR UPDATE SKIP LOCKED
         )
         DELETE FROM public.news_media AS media
         USING expired
         WHERE media.id = expired.id
         RETURNING media.id`,
        [NEWS_MEDIA_ORPHAN_RETENTION_DAYS],
      );
      return result.rowCount ?? 0;
    } finally {
      this.cleanupInProgress = false;
    }
  }

  static isUuidV4(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
