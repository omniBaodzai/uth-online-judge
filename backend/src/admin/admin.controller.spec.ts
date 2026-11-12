import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminController } from './admin.controller.js';

describe('AdminController illustration upload', () => {
  it('requires both JWT authentication and the Admin role', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([
      JwtAuthGuard,
      AdminRoleGuard,
    ]);
  });

  it('stores the uploaded image under the authenticated admin identity', async () => {
    const illustrations = { save: vi.fn().mockResolvedValue('/problems/illustrations/image-id') };
    const controller = new AdminController({} as never, illustrations as never);

    await expect(controller.uploadProblemIllustration(
      { buffer: Buffer.from('png') } as never,
      { user: { id: 'admin-1', role: 'ADMIN' } } as never,
    )).resolves.toEqual({ url: '/problems/illustrations/image-id' });
    expect(illustrations.save).toHaveBeenCalledWith(Buffer.from('png'), 'admin-1');
  });

  it('delegates dashboard chart requests to the guarded Admin statistics service', async () => {
    const admin = {
      dashboardStatistics: vi.fn().mockResolvedValue({
        timezone: 'Asia/Ho_Chi_Minh',
        days: 7,
        submissionScope: 'GLOBAL',
        submissions: { total: 0, daily: [] },
        users: { total: 0, daily: [] },
      }),
    };
    const controller = new AdminController(admin as never, {} as never);
    const query = { days: 7, submissionScope: 'GLOBAL' } as const;

    await expect(controller.dashboardStatistics(query)).resolves.toMatchObject({
      timezone: 'Asia/Ho_Chi_Minh',
      days: 7,
    });
    expect(admin.dashboardStatistics).toHaveBeenCalledWith(query);
  });
});
