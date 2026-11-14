import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { ContributorsController } from './contributors.controller.js';

describe('ContributorsController', () => {
  it('exposes a public GET /contributors and delegates the query', async () => {
    const service = {
      getContributors: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const controller = new ContributorsController(service as never);
    const query = { page: 2, pageSize: 5, q: 'admin' };

    await expect(controller.get(query as never)).resolves.toEqual({
      items: [],
      total: 0,
    });
    expect(service.getContributors.mock.calls).toEqual([[query]]);
    const handler = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(controller),
      'get',
    )?.value;
    expect(Reflect.getMetadata(PATH_METADATA, ContributorsController)).toBe(
      'contributors',
    );
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(0);
  });
});
