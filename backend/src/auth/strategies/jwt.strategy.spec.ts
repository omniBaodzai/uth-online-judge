import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy.js';
import type { UsersService } from '../../users/users.service.js';

describe('JwtStrategy', () => {
  const originalSecret = process.env.JWT_ACCESS_SECRET;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret-with-at-least-32-characters';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalSecret;
  });

  it('loads the current role and active state from the database instead of the token', async () => {
    const users = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1',
        is_active: true,
        role: 'ADMIN',
      }),
    };
    const strategy = new JwtStrategy(users as unknown as UsersService);

    await expect(strategy.validate({ sub: 'user-1' })).resolves.toEqual({
      id: 'user-1',
      role: 'ADMIN',
    });
    expect(users.findById).toHaveBeenCalledWith('user-1');
  });

  it('rejects missing or inactive users', async () => {
    const users = { findById: vi.fn().mockResolvedValue(null) };
    const strategy = new JwtStrategy(users as unknown as UsersService);

    await expect(strategy.validate({ sub: 'missing' })).rejects.toBeInstanceOf(UnauthorizedException);
    users.findById.mockResolvedValue({ id: 'inactive', is_active: false, role: 'ADMIN' });
    await expect(strategy.validate({ sub: 'inactive' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
