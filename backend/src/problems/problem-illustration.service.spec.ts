import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProblemIllustrationService } from './problem-illustration.service.js';

describe('ProblemIllustrationService', () => {
  it('stores validated raster image bytes in PostgreSQL and returns a public resource URL', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: '11111111-1111-4111-8111-111111111111' }] }),
    };
    const service = new ProblemIllustrationService(database as never);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

    await expect(service.save(png, 'admin-1')).resolves.toBe(
      '/problems/illustrations/11111111-1111-4111-8111-111111111111',
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO problem_illustrations'),
      [png, 'image/png', 'admin-1'],
    );
  });

  it('rejects empty and unsupported image data before sending it to the database', async () => {
    const database = { query: vi.fn() };
    const service = new ProblemIllustrationService(database as never);

    await expect(service.save(Buffer.alloc(0), 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.save(Buffer.from('<svg/>'), 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('returns only image bytes and content type for an existing image', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [{ image_data: Buffer.from('png'), content_type: 'image/png' }],
      }),
    };
    const service = new ProblemIllustrationService(database as never);

    await expect(service.find('image-id')).resolves.toEqual({
      image: Buffer.from('png'),
      contentType: 'image/png',
    });
  });

  it('reports a missing image explicitly', async () => {
    const service = new ProblemIllustrationService({ query: vi.fn().mockResolvedValue({ rows: [] }) } as never);

    await expect(service.find('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
