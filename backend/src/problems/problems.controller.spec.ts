import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ProblemsController } from './problems.controller.js';

describe('ProblemsController editorial endpoint', () => {
  it('requires JWT and forwards only the authenticated user ID', async () => {
    const problems = { getEditorial: vi.fn().mockResolvedValue({ editorials: [] }) };
    const controller = new ProblemsController(problems as never);
    const handler = Object.getOwnPropertyDescriptor(ProblemsController.prototype, 'editorial')?.value;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([JwtAuthGuard]);
    await controller.editorial('UTH001', { user: { id: 'jwt-user' } } as never);
    expect(problems.getEditorial.mock.calls).toEqual([['UTH001', 'jwt-user']]);
  });
});
