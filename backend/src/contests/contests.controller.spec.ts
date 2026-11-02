import { HttpStatus } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { ContestsController } from './contests.controller.js';

describe('ContestsController', () => {
  it('protects every Admin contest endpoint with JWT and Admin role guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ContestsController)).toEqual([
      JwtAuthGuard,
      AdminRoleGuard,
    ]);
  });

  it('uses the documented 200 status for contest state transitions', () => {
    for (const method of ['publish', 'archive', 'restore'] as const) {
      expect(
        Reflect.getMetadata(HTTP_CODE_METADATA, ContestsController.prototype[method]),
      ).toBe(HttpStatus.OK);
    }
  });

  it('passes the authenticated Admin identity to contest creation', async () => {
    const contests = { create: vi.fn().mockResolvedValue({ id: 'contest-id' }) };
    const controller = new ContestsController(contests as never);
    const input = {
      slug: 'contest-2026',
      title: 'Contest',
      startsAt: '2026-11-01T07:00:00Z',
      endsAt: '2026-11-01T12:00:00Z',
    };

    await expect(controller.create(input, {
      user: { id: 'admin-id', role: 'ADMIN' },
    } as never)).resolves.toEqual({ id: 'contest-id' });
    expect(contests.create).toHaveBeenCalledWith(input, 'admin-id');
  });
});
