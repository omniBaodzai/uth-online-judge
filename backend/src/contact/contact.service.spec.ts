import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContactRepository } from './contact.repository.js';
import { ContactService } from './contact.service.js';

describe('ContactService', () => {
  function createService() {
    const repository = {
      consumePublicSubmissionLimit: vi.fn().mockResolvedValue(true),
      createMessage: vi.fn().mockResolvedValue({
        id: 'message-id',
        status: 'NEW',
        createdAt: '2026-11-02T00:00:00.000Z',
      }),
      findAdminMessage: vi.fn(),
      updateStatus: vi.fn(),
      listAdmin: vi.fn(),
      listUserMessages: vi.fn(),
      findUserMessage: vi.fn(),
      createReply: vi.fn(),
      listNotifications: vi.fn(),
      unreadNotificationCount: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    };
    return {
      repository,
      service: new ContactService(repository as unknown as ContactRepository),
    };
  }

  it('stores a guest request without linking an account and reports no online tracking', async () => {
    const { repository, service } = createService();
    const input = {
      fullName: 'Guest',
      email: 'guest@example.com',
      subject: 'Help',
      content: 'Details',
    };

    await expect(service.createMessage(input, null, '203.0.113.1')).resolves.toEqual({
      id: 'message-id',
      status: 'NEW',
      createdAt: '2026-11-02T00:00:00.000Z',
      trackingAvailable: false,
    });
    expect(repository.createMessage).toHaveBeenCalledWith({ ...input, userId: null });
  });

  it('links authenticated requests to the JWT user and applies the public rate limit', async () => {
    const { repository, service } = createService();
    const input = {
      fullName: 'Student',
      email: 'student@example.com',
      subject: 'Help',
      content: 'Details',
    };

    await expect(service.createMessage(input, 'user-id', '203.0.113.2')).resolves.toMatchObject({
      trackingAvailable: true,
    });
    expect(repository.createMessage).toHaveBeenCalledWith({ ...input, userId: 'user-id' });

    repository.consumePublicSubmissionLimit.mockResolvedValue(false);
    await expect(service.createMessage(input, null, '203.0.113.2'))
      .rejects.toMatchObject({ status: 429 });
    expect(repository.createMessage).toHaveBeenCalledOnce();
  });

  it('hides missing and non-owned requests behind the same not-found response', async () => {
    const { repository, service } = createService();
    repository.findUserMessage.mockResolvedValue(null);
    await expect(service.getUserMessage('other-user', 'message-id'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findUserMessage).toHaveBeenCalledWith('other-user', 'message-id');
  });

  it('delegates ownership and resolved-status checks to the transactional repository', async () => {
    const { repository, service } = createService();
    repository.createReply.mockRejectedValueOnce(new NotFoundException());
    await expect(service.createReply({
      contactMessageId: 'message-id',
      senderUserId: 'user-id',
      senderRole: 'USER',
      content: 'Reply',
      idempotencyKey: null,
      requireOwner: true,
    })).rejects.toBeInstanceOf(NotFoundException);

    repository.createReply.mockRejectedValueOnce(new ConflictException());
    await expect(service.createReply({
      contactMessageId: 'message-id',
      senderUserId: 'user-id',
      senderRole: 'USER',
      content: 'Reply',
      idempotencyKey: null,
      requireOwner: true,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('scopes notification operations to the authenticated user provided by the controller', async () => {
    const { repository, service } = createService();
    repository.markNotificationRead.mockResolvedValue(false);
    await expect(service.markNotificationRead('user-id', 'notification-id'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(repository.markNotificationRead).toHaveBeenCalledWith('user-id', 'notification-id');

    repository.unreadNotificationCount.mockResolvedValue(3);
    await expect(service.unreadNotificationCount('user-id')).resolves.toEqual({ count: 3 });
  });
});
