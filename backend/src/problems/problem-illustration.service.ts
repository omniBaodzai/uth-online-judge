import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../databases/database.module.js';
import { detectImageType } from '../auth/avatar-storage.service.js';

export const PROBLEM_ILLUSTRATION_MAX_BYTES = 5 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

@Injectable()
export class ProblemIllustrationService {
  constructor(@Inject(DATABASE_POOL) private readonly database: Pool) {}

  async save(buffer: Buffer, authorId: string): Promise<string> {
    if (buffer.length === 0 || buffer.length > PROBLEM_ILLUSTRATION_MAX_BYTES) {
      throw new BadRequestException('Ảnh minh họa phải có dung lượng tối đa 5 MB.');
    }

    const type = detectImageType(buffer);
    if (!type) {
      throw new BadRequestException('Chỉ chấp nhận ảnh PNG, JPEG, WebP hoặc GIF hợp lệ.');
    }
    const contentType = CONTENT_TYPES[type.extension];
    if (!contentType) throw new BadRequestException('Định dạng ảnh minh họa không được hỗ trợ.');

    const result = await this.database.query<{ id: string }>(
      `INSERT INTO problem_illustrations (image_data, content_type, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [buffer, contentType, authorId],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('Problem illustration insert did not return an id');
    return `/problems/illustrations/${id}`;
  }

  async find(id: string): Promise<{ image: Buffer; contentType: string }> {
    const result = await this.database.query<{ image_data: Buffer; content_type: string }>(
      `SELECT image_data, content_type
       FROM problem_illustrations
       WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy ảnh minh họa.');
    return { image: row.image_data, contentType: row.content_type };
  }
}
