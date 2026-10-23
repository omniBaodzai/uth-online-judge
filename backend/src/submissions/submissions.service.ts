import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  JUDGE_SUBMISSION_JOB,
  JUDGING_JOB_OPTIONS,
  JUDGING_QUEUE,
  type JudgeSubmissionJobData,
} from '../queues/judging-queue.constants.js';
import type { GlobalSubmissionPage, GlobalSubmissionQuery } from './global-submissions.js';
import {
  SubmissionsRepository,
  type CreatedSubmission,
  type ProblemSubmissionPage,
  type SubmissionView,
} from './submissions.repository.js';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly repository: SubmissionsRepository,
    @InjectQueue(JUDGING_QUEUE)
    private readonly judgingQueue: Queue<JudgeSubmissionJobData>,
  ) {}

  async create(
    userId: string,
    input: { problemCode: string; language: string; sourceCode: string },
  ): Promise<CreatedSubmission> {
    const startedAt = performance.now();
    const problemId = await this.repository.findPublishedProblemId(input.problemCode);
    if (!problemId) throw new NotFoundException('Không tìm thấy bài tập.');

    const languageId = await this.repository.findAllowedLanguageId(problemId, input.language);
    if (!languageId) throw new BadRequestException('Ngôn ngữ không được hỗ trợ cho bài tập này.');

    const created = await this.repository.insert({
      userId,
      problemId,
      languageId,
      sourceCode: input.sourceCode,
    });
    const persistedAt = performance.now();
    try {
      await this.judgingQueue.add(
        JUDGE_SUBMISSION_JOB,
        { submissionId: created.id },
        { jobId: created.id, ...JUDGING_JOB_OPTIONS },
      );
      await this.repository.markQueued(created.id);
      this.logger.log(
        `Submission pipeline timings id=${created.id} databaseMs=${Math.round(persistedAt - startedAt)} enqueueAndQueueStateMs=${Math.round(performance.now() - persistedAt)} totalMs=${Math.round(performance.now() - startedAt)}`,
      );
    } catch (error) {
      try {
        await this.repository.markEnqueueFailed(created.id);
      } catch (persistenceError) {
        this.logger.error(
          `Could not persist enqueue failure for submission ${created.id} (${errorName(persistenceError)})`,
        );
      }
      this.logger.error(`Could not enqueue submission ${created.id} (${errorName(error)})`);
      throw new ServiceUnavailableException('Không thể đưa bài nộp vào hàng đợi chấm. Vui lòng thử lại sau.');
    }

    this.logger.log(`Queued submission ${created.id}`);
    return { ...created, status: 'QUEUED' };
  }

  async getOwned(id: string, userId: string): Promise<SubmissionView> {
    const submission = await this.repository.findOwned(id, userId);
    if (!submission) throw new NotFoundException('Không tìm thấy bài nộp.');
    return submission;
  }

  async getGlobalSubmissions(
    viewerId: string | null,
    query: GlobalSubmissionQuery,
  ): Promise<GlobalSubmissionPage> {
    const page = await this.repository.findGlobalSubmissions(viewerId, query);
    if (!page) throw new NotFoundException('Không tìm thấy bài tập.');
    return page;
  }

  async getProblemSubmissions(
    userId: string,
    problemCode: string,
    query: { page: number; pageSize: number; status?: string; language?: string },
  ): Promise<ProblemSubmissionPage> {
    const submissions = await this.repository.findProblemSubmissions(
      userId,
      problemCode,
      query.page,
      query.pageSize,
      query.status,
      query.language,
    );
    if (!submissions) throw new NotFoundException('Không tìm thấy bài tập.');
    return submissions;
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown error';
}
