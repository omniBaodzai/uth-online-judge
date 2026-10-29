import { BadRequestException } from '@nestjs/common';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CoverStorageService, COVER_MAX_BYTES, isLocalCover } from './cover-storage.service.js';

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);

describe('cover storage', () => {
  let directory: string;
  let storage: CoverStorageService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'profile-covers-'));
    process.env.UPLOAD_DIR = directory;
    storage = new CoverStorageService();
  });

  afterEach(async () => {
    delete process.env.UPLOAD_DIR;
    await rm(directory, { recursive: true, force: true });
  });

  it('stores supported image bytes under an unguessable cover path', async () => {
    const url = await storage.save(png);
    expect(isLocalCover(url)).toBe(true);
    expect(await readdir(storage.coverDir)).toHaveLength(1);
  });

  it('rejects invalid and oversized images', async () => {
    await expect(storage.save(Buffer.from('<svg></svg>'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(storage.save(Buffer.alloc(COVER_MAX_BYTES + 1))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes only generated cover paths', async () => {
    const url = await storage.save(png);
    await storage.remove('https://example.com/cover.jpg');
    await storage.remove('/uploads/covers/../../etc/passwd');
    expect(await readdir(storage.coverDir)).toHaveLength(1);
    await storage.remove(url);
    expect(await readdir(storage.coverDir)).toHaveLength(0);
  });
});