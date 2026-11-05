import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ContactMessageStatus,
  ContactReplySenderRole,
  ProblemReportType,
} from './contact.dto.js';
import {
  ContactRepository,
  type ContactMessageListQuery,
  type ContactMessageRecord,
  type ContactReplyResult,
} from './contact.repository.js';

const REPORT_TYPE_SUBJECTS: Record<ProblemReportType, string> = {
  INCORRECT_STATEMENT: 'Đề bài sai hoặc thiếu thông tin',
  INCORRECT_TEST_DATA: 'Dữ liệu kiểm thử không chính xác',
  DISPLAY_ISSUE: 'Lỗi hiển thị',
  OTHER: 'Vấn đề khác',
};

@Injectable()
export class ContactService {
  constructor(private readonly contact: ContactRepository) {}

  async createMessage(
    input: { fullName: string; email: string; subject: string; content: string },
    userId: string | null,
    ipAddress: string,
  ): Promise<{ id: string; status: ContactMessageStatus; createdAt: string; trackingAvailable: boolean }> {
    if (!await this.contact.consumePublicSubmissionLimit(ipAddress)) {
      throw new HttpException(
        'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau một giờ.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const message = await this.contact.createMessage({ ...input, userId });
    return {
      id: message.id,
      status: message.status,
      createdAt: message.createdAt,
      trackingAvailable: userId !== null,
    };
  }

  async createProblemReport(
    code: string,
    userId: string,
    input: { reportType: ProblemReportType; content: string },
  ): Promise<{ id: string; status: ContactMessageStatus; createdAt: string }> {
    const [problem, identity] = await Promise.all([
      this.contact.findPublishedProblem(code),
      this.contact.findUserIdentity(userId),
    ]);
    if (!problem) throw new NotFoundException('Không tìm thấy bài tập.');
    if (!identity) throw new NotFoundException('Không tìm thấy tài khoản người gửi.');
    // Bộ đếm riêng theo tài khoản, tách khỏi quota theo IP của form liên hệ.
    if (!await this.contact.consumePublicSubmissionLimit(`problem-report:${userId}`)) {
      throw new HttpException(
        'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau một giờ.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const message = await this.contact.createProblemReport({
      userId,
      fullName: identity.username ?? identity.email,
      email: identity.email,
      subject: `[Báo cáo] ${problem.code} – ${REPORT_TYPE_SUBJECTS[input.reportType]}`,
      content: input.content,
      reportType: input.reportType,
      problem,
    });
    return { id: message.id, status: message.status, createdAt: message.createdAt };
  }

  listAdmin(query: ContactMessageListQuery) {
    return this.contact.listAdmin(query);
  }

  async getAdminMessage(id: string) {
    const message = await this.contact.findAdminMessage(id);
    if (!message) throw new NotFoundException('Không tìm thấy yêu cầu liên hệ.');
    return message;
  }

  async updateStatus(id: string, status: ContactMessageStatus): Promise<ContactMessageRecord> {
    const message = await this.contact.updateStatus(id, status);
    if (!message) throw new NotFoundException('Không tìm thấy yêu cầu liên hệ.');
    return message;
  }

  listUserMessages(userId: string, page: number, pageSize: number) {
    return this.contact.listUserMessages(userId, page, pageSize);
  }

  async getUserMessage(userId: string, id: string) {
    const message = await this.contact.findUserMessage(userId, id);
    if (!message) throw new NotFoundException('Không tìm thấy yêu cầu liên hệ.');
    return message;
  }

  createReply(input: {
    contactMessageId: string;
    senderUserId: string;
    senderRole: ContactReplySenderRole;
    content: string;
    idempotencyKey: string | null;
    requireOwner?: boolean;
  }): Promise<ContactReplyResult> {
    return this.contact.createReply(input);
  }

  listNotifications(userId: string, page: number, pageSize: number) {
    return this.contact.listNotifications(userId, page, pageSize);
  }

  async unreadNotificationCount(userId: string) {
    return { count: await this.contact.unreadNotificationCount(userId) };
  }

  async markNotificationRead(userId: string, id: string) {
    const updated = await this.contact.markNotificationRead(userId, id);
    if (!updated) {
      throw new NotFoundException('Không tìm thấy thông báo.');
    }
    return { id, isRead: true };
  }

  async markAllNotificationsRead(userId: string) {
    return { updated: await this.contact.markAllNotificationsRead(userId) };
  }
}
