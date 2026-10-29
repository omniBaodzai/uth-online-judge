import { BadRequestException } from '@nestjs/common';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AVATAR_MAX_BYTES,
  AvatarStorageService,
  detectImageType,
  isLocalAvatar,
} from './avatar-storage.service.js';

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);

describe('avatar storage', () => {
  let dir: string;
  let storage: AvatarStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'avatars-'));
    process.env.UPLOAD_DIR = dir;
    storage = new AvatarStorageService();
  });

  afterEach(async () => {
    delete process.env.UPLOAD_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('detects image formats from content, not from names', () => {
    expect(detectImageType(png)?.extension).toBe('png');
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe('jpg');
    expect(detectImageType(Buffer.from('GIF89a....'))?.extension).toBe('gif');
    expect(detectImageType(Buffer.from('RIFF\0\0\0\0WEBP'))?.extension).toBe('webp');
    expect(detectImageType(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
  });

  it('saves a valid image under a random server-generated name', async () => {
    const url = await storage.save(png);
    expect(isLocalAvatar(url)).toBe(true);
    expect(await readdir(storage.avatarDir)).toHaveLength(1);
  });

  it('rejects non-image and oversized content', async () => {
    await expect(storage.save(Buffer.from('<script>alert(1)</script>'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(storage.save(Buffer.alloc(AVATAR_MAX_BYTES + 1, 1))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('removes only files it manages', async () => {
    const url = await storage.save(png);
    await storage.remove('https://example.com/a.png');
    await storage.remove('/uploads/avatars/../../etc/passwd');
    expect(await readdir(storage.avatarDir)).toHaveLength(1);
    await storage.remove(url);
    expect(await readdir(storage.avatarDir)).toHaveLength(0);
  });
});
