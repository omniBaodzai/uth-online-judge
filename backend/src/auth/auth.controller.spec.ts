import 'reflect-metadata';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthController, REFRESH_COOKIE_NAME } from './auth.controller.js';
import { PublicProfileController } from '../users/public-profile.controller.js';

function guardsOf(prototype: object, methodName: string): unknown[] {
  const method = Object.getOwnPropertyDescriptor(prototype, methodName)?.value;
  return Reflect.getMetadata('__guards__', method) ?? [];
}

describe('cover upload authorization', () => {
  it('requires authentication and uses the caller ID instead of accepting an owner ID', async () => {
    const auth = { uploadCover: vi.fn().mockResolvedValue({ id: 'owner' }) };
    const controller = new AuthController(auth as never, {} as never);
    const request = { user: { id: 'owner', role: 'STUDENT' } } as never;
    const crop = { x: 0, y: 0, width: 1280, height: 400, sourceWidth: 1280, sourceHeight: 400, aspect: 3.2 };

    const guards = guardsOf(AuthController.prototype, 'uploadCover');
    expect(guards).toContain(JwtAuthGuard);
    await controller.uploadCover(request, { buffer: Buffer.from('cover') } as never, { crop } as never);
    expect(auth.uploadCover).toHaveBeenCalledWith('owner', Buffer.from('cover'), crop);
  });

  describe('change password authorization', () => {
    it('requires authentication and scopes the operation to the JWT user', async () => {
      const auth = { changePassword: vi.fn().mockResolvedValue(undefined) };
      const controller = new AuthController(auth as never, {} as never);
      const request = {
        user: { id: 'owner', role: 'STUDENT' },
        headers: { cookie: `${REFRESH_COOKIE_NAME}=refresh-token; other=value` },
      } as never;
      const guards = guardsOf(AuthController.prototype, 'changePassword');

      expect(guards).toContain(JwtAuthGuard);
      await controller.changePassword(
        request,
        { currentPassword: 'current-password', newPassword: 'new-password' } as never,
      );
      expect(auth.changePassword).toHaveBeenCalledWith(
        'owner',
        'current-password',
        'new-password',
        'refresh-token',
      );
    });
  });

  it('requires authentication and scopes profile updates to the JWT subject', async () => {
    const auth = { updateProfile: vi.fn().mockResolvedValue({ id: 'owner' }) };
    const controller = new AuthController(auth as never, {} as never);
    const request = { user: { id: 'owner', role: 'STUDENT' } } as never;
    const guards = guardsOf(AuthController.prototype, 'updateMe');

    expect(guards).toContain(JwtAuthGuard);
    await controller.updateMe(request, { bio: 'About me' } as never);
    expect(auth.updateProfile).toHaveBeenCalledWith('owner', { bio: 'About me' });
  });
});

describe('password reset endpoints', () => {
  it('keeps the forgot-password response public and applies the request IP rate key', async () => {
    const passwordReset = {
      requestOtp: vi.fn().mockResolvedValue({ message: 'generic', retryAfterSeconds: 60 }),
    };
    const controller = new AuthController({} as never, passwordReset as never);
    const request = {
      ip: '192.0.2.10',
      socket: { remoteAddress: '192.0.2.11' },
    } as never;

    expect(guardsOf(AuthController.prototype, 'forgotPassword')).toEqual([]);
    await expect(controller.forgotPassword({ email: 'user@example.com' } as never, request))
      .resolves.toMatchObject({ retryAfterSeconds: 60 });
    expect(passwordReset.requestOtp).toHaveBeenCalledWith('user@example.com', '192.0.2.10');
  });

  it('verifies OTP and clears browser refresh cookies after password reset', async () => {
    const passwordReset = {
      verifyOtp: vi.fn().mockResolvedValue({ resetToken: 'one-time-token' }),
      resetPassword: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new AuthController({} as never, passwordReset as never);
    const response = { clearCookie: vi.fn() } as never;

    await expect(controller.verifyResetOtp({
      email: 'user@example.com',
      otp: '012345',
    } as never)).resolves.toEqual({ resetToken: 'one-time-token' });
    await controller.resetPassword({
      resetToken: 'a'.repeat(43),
      newPassword: 'new-secure-password',
    } as never, response);

    expect(passwordReset.verifyOtp).toHaveBeenCalledWith('user@example.com', '012345');
    expect(passwordReset.resetPassword).toHaveBeenCalledWith(
      'a'.repeat(43),
      'new-secure-password',
    );
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });
});

describe('public profile access', () => {
  it('does not require authentication for username and id lookups', async () => {
    const profiles = {
      getByUsername: vi.fn().mockResolvedValue({ user: { username: 'coder' } }),
      getById: vi.fn().mockResolvedValue({ user: { id: 'coder-id' } }),
    };
    const controller = new PublicProfileController(profiles as never);

    expect(guardsOf(PublicProfileController.prototype, 'getByUsername')).toEqual([]);
    expect(guardsOf(PublicProfileController.prototype, 'getById')).toEqual([]);
    await expect(controller.getByUsername('coder')).resolves.toEqual({ user: { username: 'coder' } });
    await expect(controller.getById('coder-id')).resolves.toEqual({ user: { id: 'coder-id' } });
  });
});