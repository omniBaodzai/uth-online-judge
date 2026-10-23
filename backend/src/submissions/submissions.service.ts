import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  SubmissionsRepository,
  type CreatedSubmission,
  type SubmissionView,
} from './submissions.repository.js';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(private readonly repository: SubmissionsRepository) {}

  // Chỉ ghi nhận bài nộp ở trạng thái PENDING; chưa chấm và chưa đưa vào hàng đợi.
  async create(
    userId: string,
    input: { problemCode: string; language: string; sourceCode: string },
  ): Promise<CreatedSubmission> {
    const problemId = await this.repository.findPublishedProblemId(input.problemCode);
    if (!problemId) throw new NotFoundException('Không tìm thấy bài tập.');

    const languageId = await this.repository.findEnabledLanguageId(input.language);
    if (!languageId) throw new BadRequestException('Ngôn ngữ không được hỗ trợ.');

    const created = await this.repository.insert({
      userId,
      problemId,
      languageId,
      sourceCode: input.sourceCode,
    });
    // Không ghi mã nguồn vào log.
    this.logger.log(`Submission ${created.id} recorded for problem ${input.problemCode}`);
    return created;
  }

  async getOwned(id: string, userId: string): Promise<SubmissionView> {
    const submission = await this.repository.findOwned(id, userId);
    if (!submission) throw new NotFoundException('Không tìm thấy bài nộp.');
    return submission;
  }
}
