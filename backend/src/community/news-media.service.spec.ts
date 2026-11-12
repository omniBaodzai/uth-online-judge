import { BadRequestException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { NewsMediaService, NEWS_MEDIA_MAX_BYTES, NEWS_MEDIA_MAX_PIXELS } from './news-media.service.js';

const mediaId = 'c4a4b748-a323-4d3a-8f76-3d72d1cb9812';

describe('NewsMediaService', () => {
  it('validates, re-encodes and stores PNG bytes with server-measured metadata', async () => {
    const source = await sharp({
      create: { width: 20, height: 12, channels: 4, background: '#3a8b89' },
    }).png().toBuffer();
    const query = vi.fn().mockResolvedValue({ rows: [{ id: mediaId }] });
    const service = new NewsMediaService({ query } as never);

    await expect(service.upload(source, 'admin-id')).resolves.toEqual({
      id: mediaId,
      url: `/news/media/${mediaId}`,
      contentType: 'image/png',
      byteSize: expect.any(Number),
      width: 20,
      height: 12,
    });
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toContain('INSERT INTO public.news_media');
    expect(query.mock.calls[0][1][0]).toBeInstanceOf(Buffer);
    expect(query.mock.calls[0][1][1]).toBe('image/png');
    expect(query.mock.calls[0][1][2]).toBe(query.mock.calls[0][1][0].length);
  });

  it.each([
    ['image/jpeg', 'jpeg'],
    ['image/webp', 'webp'],
  ] as const)('accepts and retains the %s image format', async (contentType, format) => {
    const source = await sharp({
      create: { width: 10, height: 8, channels: 3, background: '#29736f' },
    }).toFormat(format).toBuffer();
    const query = vi.fn().mockResolvedValue({ rows: [{ id: mediaId }] });
    const service = new NewsMediaService({ query } as never);

    await service.upload(source, 'admin-id');
    expect(query.mock.calls[0][1][1]).toBe(contentType);
  });

  it('rejects unsupported, oversized, malformed and excessive-pixel images before persistence', async () => {
    const query = vi.fn();
    const service = new NewsMediaService({ query } as never);
    const tooManyPixels = await sharp({
      create: { width: 4_001, height: 4_000, channels: 3, background: '#fff' },
    }).png().toBuffer();

    await expect(service.upload(Buffer.from('not an image'), 'admin-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upload(Buffer.alloc(NEWS_MEDIA_MAX_BYTES + 1), 'admin-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upload(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'admin-id')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.upload(tooManyPixels, 'admin-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(4_001 * 4_000).toBeGreaterThan(NEWS_MEDIA_MAX_PIXELS);
    expect(query).not.toHaveBeenCalled();
  });

  it('only serves public media when a published article references it', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const service = new NewsMediaService({ query } as never);

    await expect(service.findPublished(mediaId)).rejects.toBeInstanceOf(NotFoundException);
    expect(query.mock.calls[0][0]).toContain("article.status = 'PUBLISHED'");
    expect(query.mock.calls[0][0]).toContain('public.news_article_media');
  });

  it('removes expired orphan media only when no article relation remains', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: mediaId }], rowCount: 1 });
    const service = new NewsMediaService({ query } as never);

    await expect(service.cleanupOrphans()).resolves.toBe(1);
    expect(query.mock.calls[0][0]).toContain("INTERVAL '1 day'");
    expect(query.mock.calls[0][0]).toContain('NOT EXISTS');
    expect(query.mock.calls[0][1]).toEqual([7]);
  });
});
