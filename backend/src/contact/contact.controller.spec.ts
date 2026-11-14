import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminRoleGuard } from '../admin/admin-role.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  AdminContactMessagesController,
  MyContactMessagesController,
  MyNotificationsController,
  PublicContactMessagesController,
  ProblemReportsController,
} from './contact.controller.js';

describe('Contact controllers access controls', () => {
  it('requires JWT for problem report creation and takes the user from the token', async () => {
    expect(Reflect.getMetadata(
      GUARDS_METADATA,
      Object.getOwnPropertyDescriptor(ProblemReportsController.prototype, 'create')?.value,
    )).toEqual([JwtAuthGuard]);
    const contact = { createProblemReport: vi.fn() };
    await new ProblemReportsController(contact as never).create(
      'hello',
      { reportType: 'OTHER', content: 'x' },
      { user: { id: 'jwt-user', role: 'STUDENT' } } as never,
    );
    expect(contact.createProblemReport)
      .toHaveBeenCalledWith('hello', 'jwt-user', { reportType: 'OTHER', content: 'x' });
  });

  it('allows optional JWT identity only on public contact creation', () => {
    expect(Reflect.getMetadata(
      GUARDS_METADATA,
      Object.getOwnPropertyDescriptor(PublicContactMessagesController.prototype, 'create')?.value,
    )).toEqual([expect.any(Function)]);
  });

  it('requires JWT and Admin role for every admin contact endpoint', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminContactMessagesController))
      .toEqual([JwtAuthGuard, AdminRoleGuard]);
  });

  it('requires JWT for user contact and notification endpoints', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MyContactMessagesController))
      .toEqual([JwtAuthGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, MyNotificationsController))
      .toEqual([JwtAuthGuard]);
  });

  it('rejects Admin accounts from posting replies through the user endpoint', () => {
    const contact = { createReply: vi.fn() };
    const controller = new MyContactMessagesController(contact as never);

    expect(() => controller.reply(
      'message-id',
      { content: 'Reply' },
      undefined,
      { user: { id: 'admin-id', role: 'ADMIN' } } as never,
    )).toThrow(ForbiddenException);
    expect(contact.createReply).not.toHaveBeenCalled();
  });

  it('scopes every notification operation to the authenticated user ID', async () => {
    const contact = {
      listNotifications: vi.fn(),
      unreadNotificationCount: vi.fn(),
      markAllNotificationsRead: vi.fn(),
      markNotificationRead: vi.fn(),
    };
    const controller = new MyNotificationsController(contact as never);
    const request = { user: { id: 'jwt-owner-id' } } as never;

    await controller.list({ page: 2, pageSize: 20 } as never, request);
    await controller.unreadCount(request);
    await controller.markAllRead(request);
    await controller.markRead('notification-id', request);

    expect(contact.listNotifications).toHaveBeenCalledWith('jwt-owner-id', 2, 20);
    expect(contact.unreadNotificationCount).toHaveBeenCalledWith('jwt-owner-id');
    expect(contact.markAllNotificationsRead).toHaveBeenCalledWith('jwt-owner-id');
    expect(contact.markNotificationRead).toHaveBeenCalledWith('jwt-owner-id', 'notification-id');
  });
});
