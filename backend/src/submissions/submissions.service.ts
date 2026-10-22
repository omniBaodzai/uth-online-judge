import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ActivityLogService } from '../platform/activity-log.service.js';
import { SettingsService } from '../platform/settings.service.js';
import type { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { JUDGE_QUEUE, resolveLanguageId } from './submission.constants.js';
import { SubmissionsRepository } from './submissions.repository.js';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly repository: SubmissionsRepository,
    @InjectQueue(JUDGE_QUEUE)
    private readonly judgeQueue: Queue,
    private readonly activity: ActivityLogService,
    private readonly settings: SettingsService,
  ) {}

  async create(userId: string, input: CreateSubmissionDto) {
    if (!(await this.settings.get()).features.submissions) {
      throw new ForbiddenException('Chức năng nộp bài đang tạm đóng.');
    }
    const languageId = resolveLanguageId(input.languageId, input.language);
    if (languageId === null) {
      throw new BadRequestException('Ngôn ngữ lập trình không được hỗ trợ.');
    }
    if (!input.sourceCode.trim()) {
      throw new BadRequestException('Vui lòng nhập mã nguồn.');
    }

    const problem = await this.repository.findProblemByCode(input.problemCode);
    if (!problem) throw new NotFoundException('Không tìm thấy bài tập.');

    const submission = await this.repository.create({
      userId,
      problemId: problem.id,
      problemCode: problem.code,
      sourceCode: input.sourceCode,
      languageId,
    });

    await this.judgeQueue.add(
      'judge',
      { submissionId: submission.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000 },
    );
    await this.activity.log({
      userId,
      action: 'SUBMIT',
      detail: { submissionId: submission.id, problemCode: problem.code, languageId },
    });
    return submission;
  }

  async get(id: string, requesterId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Không tìm thấy bài nộp.');
    const submission = await this.repository.findById(id, true);
    if (!submission) throw new NotFoundException('Không tìm thấy bài nộp.');
    if (submission.userId !== requesterId) {
      const { sourceCode: _hidden, ...publicView } = submission;
      return publicView;
    }
    return submission;
  }

  list(query: { userId?: string; problemCode?: string; page: number; pageSize: number }) {
    return this.repository.list({
      userId: query.userId,
      problemCode: query.problemCode,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
  }
}
