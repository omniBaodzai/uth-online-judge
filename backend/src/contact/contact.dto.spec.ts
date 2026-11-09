import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ContactReplyDto,
  CreateContactMessageDto,
  CreateProblemReportDto,
  ListContactMessagesQueryDto,
  UpdateContactMessageStatusDto,
  validateIdempotencyKey,
} from './contact.dto.js';

describe('contact DTO validation', () => {
  it('trims submitted text and rejects empty required fields', () => {
    const valid = plainToInstance(CreateContactMessageDto, {
      fullName: '  Student Name ',
      email: ' student@example.com ',
      subject: ' Need help ',
      content: ' Details here ',
    });
    expect(valid.fullName).toBe('Student Name');
    expect(valid.email).toBe('student@example.com');
    expect(validateSync(valid)).toHaveLength(0);

    const invalid = plainToInstance(CreateContactMessageDto, {
      fullName: '  ',
      email: 'bad',
      subject: ' ',
      content: ' ',
    });
    expect(validateSync(invalid).length).toBeGreaterThanOrEqual(4);
  });

  it('rejects excessively long content and whitespace-only replies', () => {
    const tooLong = plainToInstance(ContactReplyDto, { content: 'x'.repeat(5001) });
    expect(validateSync(tooLong).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(ContactReplyDto, { content: ' \n ' })).length)
      .toBeGreaterThan(0);
  });

  it('validates the supported message statuses and list filters', () => {
    expect(validateSync(plainToInstance(UpdateContactMessageStatusDto, { status: 'IN_PROGRESS' })))
      .toHaveLength(0);
    expect(validateSync(plainToInstance(UpdateContactMessageStatusDto, { status: 'CLOSED' })).length)
      .toBeGreaterThan(0);
    expect(validateSync(plainToInstance(ListContactMessagesQueryDto, {
      page: '2',
      pageSize: '20',
      status: 'NEW',
    }))).toHaveLength(0);
    expect(validateSync(plainToInstance(ListContactMessagesQueryDto, { status: 'CLOSED' })).length)
      .toBeGreaterThan(0);
  });

  it('validates problem report type, trims content and bounds its length', () => {
    const valid = plainToInstance(CreateProblemReportDto, {
      reportType: 'DISPLAY_ISSUE',
      content: '  Sai ví dụ  ',
    });
    expect(valid.content).toBe('Sai ví dụ');
    expect(validateSync(valid)).toHaveLength(0);
    for (const body of [
      { reportType: 'Lỗi hiển thị', content: 'x' },
      { reportType: 'OTHER', content: '   ' },
      { reportType: 'OTHER', content: 'x'.repeat(1001) },
    ]) {
      expect(validateSync(plainToInstance(CreateProblemReportDto, body)).length).toBeGreaterThan(0);
    }
    expect(validateSync(plainToInstance(ListContactMessagesQueryDto, { category: 'PROBLEM_REPORT' })))
      .toHaveLength(0);
    expect(validateSync(plainToInstance(ListContactMessagesQueryDto, { category: 'X' })).length)
      .toBeGreaterThan(0);
  });

  it('accepts only UUID v4 idempotency keys', () => {
    const validKey = '550e8400-e29b-41d4-a716-446655440000';
    expect(validateIdempotencyKey(validKey)).toBe(validKey);
    expect(validateIdempotencyKey(undefined)).toBeNull();
    expect(() => validateIdempotencyKey('invalid')).toThrow(BadRequestException);
  });
});
