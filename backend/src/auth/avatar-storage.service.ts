import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export const AVATAR_PUBLIC_PREFIX = '/uploads/avatars/';
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

type ImageType = { extension: string };

// Nhận diện định dạng theo nội dung (magic bytes), không tin MIME type hay tên file của client.
export function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: 'png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { extension: 'webp' };
  }
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) {
    return { extension: 'gif' };
  }
  return null;
}

export function isLocalAvatar(avatarUrl: string | null | undefined): avatarUrl is string {
  return typeof avatarUrl === 'string' && /^\/uploads\/avatars\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(avatarUrl);
}

@Injectable()
export class AvatarStorageService {
  readonly root = resolve(process.env.UPLOAD_DIR ?? 'uploads');
  readonly avatarDir = resolve(this.root, 'avatars');

  async save(buffer: Buffer): Promise<string> {
    if (buffer.length === 0 || buffer.length > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Ảnh đại diện phải có dung lượng tối đa 2 MB.');
    }
    const type = detectImageType(buffer);
    if (!type) {
      throw new BadRequestException('Chỉ chấp nhận ảnh PNG, JPEG, WebP hoặc GIF hợp lệ.');
    }

    await mkdir(this.avatarDir, { recursive: true });
    const fileName = `${randomUUID()}.${type.extension}`;
    await writeFile(resolve(this.avatarDir, fileName), buffer, { flag: 'wx' });
    return `${AVATAR_PUBLIC_PREFIX}${fileName}`;
  }

  async remove(avatarUrl: string | null | undefined): Promise<void> {
    if (!isLocalAvatar(avatarUrl)) return;
    try {
      await unlink(resolve(this.avatarDir, basename(avatarUrl)));
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return;
      throw error;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
