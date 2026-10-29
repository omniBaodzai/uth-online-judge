import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { detectImageType } from './avatar-storage.service.js';

export const COVER_PUBLIC_PREFIX = '/uploads/covers/';
export const COVER_MAX_BYTES = 5 * 1024 * 1024;

export function isLocalCover(coverUrl: string | null | undefined): coverUrl is string {
  return typeof coverUrl === 'string' && /^\/uploads\/covers\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(coverUrl);
}

@Injectable()
export class CoverStorageService {
  readonly root = resolve(process.env.UPLOAD_DIR ?? 'uploads');
  readonly coverDir = resolve(this.root, 'covers');

  async save(buffer: Buffer): Promise<string> {
    if (buffer.length === 0 || buffer.length > COVER_MAX_BYTES) {
      throw new BadRequestException('Ảnh bìa phải có dung lượng tối đa 5 MB.');
    }
    const type = detectImageType(buffer);
    if (!type) {
      throw new BadRequestException('Chỉ chấp nhận ảnh PNG, JPEG, WebP hoặc GIF hợp lệ.');
    }

    await mkdir(this.coverDir, { recursive: true });
    const fileName = `${randomUUID()}.${type.extension}`;
    await writeFile(resolve(this.coverDir, fileName), buffer, { flag: 'wx' });
    return `${COVER_PUBLIC_PREFIX}${fileName}`;
  }

  async remove(coverUrl: string | null | undefined): Promise<void> {
    if (!isLocalCover(coverUrl)) return;
    try {
      await unlink(resolve(this.coverDir, basename(coverUrl)));
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return;
      throw error;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}