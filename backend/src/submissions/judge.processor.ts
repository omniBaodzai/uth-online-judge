import { HttpService } from '@nestjs/axios';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import {
  JUDGE_QUEUE,
  mapJudge0Status,
  type SubmissionStatus,
} from './submission.constants.js';
import { SubmissionsRepository, type JudgeResult } from './submissions.repository.js';

type Judge0Result = {
  token: string;
  status: { id: number; description?: string };
  time: string | null;
  memory: number | null;
  compile_output: string | null;
  stderr: string | null;
};

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const FIELDS = 'token,status,time,memory,compile_output,stderr';

const toBase64 = (value: string) => Buffer.from(value, 'utf8').toString('base64');
const fromBase64 = (value: string | null | undefined) =>
  value ? Buffer.from(value, 'base64').toString('utf8') : null;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Processor(JUDGE_QUEUE)
export class JudgeProcessor extends WorkerHost {
  private readonly logger = new Logger(JudgeProcessor.name);

  constructor(
    private readonly repository: SubmissionsRepository,
    private readonly http: HttpService,
  ) {
    super();
  }

  private get judge0Url() {
    return (process.env.JUDGE0_URL ?? 'http://localhost:2358').replace(/\/$/, '');
  }

  private get headers() {
    const token = process.env.JUDGE0_AUTH_TOKEN;
    return token ? { 'X-Auth-Token': token } : {};
  }

  async process(job: Job<{ submissionId: string }>): Promise<void> {
    const { submissionId } = job.data;
    try {
      await this.judge(submissionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Judging ${submissionId} failed: ${message}`);
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (isLastAttempt) {
        await this.repository.saveResult(submissionId, {
          status: 'RE',
          executionTime: null,
          memoryUsed: null,
          score: 0,
          passedTests: 0,
          totalTests: 0,
          compileOutput: 'Hệ thống chấm gặp lỗi nội bộ. Vui lòng nộp lại sau.',
        });
      }
      throw error;
    }
  }

  private async judge(submissionId: string): Promise<void> {
    const data = await this.repository.getForJudging(submissionId);
    if (!data) return;

    await this.repository.markJudging(submissionId);

    if (data.testCases.length === 0) {
      throw new Error('Bài tập chưa có test case.');
    }

    const { problem } = data;
    const body = {
      submissions: data.testCases.map((test) => ({
        source_code: toBase64(data.sourceCode),
        language_id: data.languageId,
        stdin: toBase64(test.input),
        expected_output: toBase64(test.expectedOutput),
        cpu_time_limit: problem.timeLimitSeconds,
        memory_limit: problem.memoryLimitMb * 1024,
      })),
    };

    const created = await firstValueFrom(
      this.http.post<{ token: string }[]>(
        `${this.judge0Url}/submissions/batch?base64_encoded=true`,
        body,
        { headers: this.headers },
      ),
    );
    const tokens = created.data.map((item) => item.token);
    if (tokens.length !== data.testCases.length || tokens.some((token) => !token)) {
      throw new Error('Judge0 trả về danh sách token không hợp lệ.');
    }

    const results = await this.poll(tokens);
    await this.repository.saveResult(submissionId, this.summarize(results, problem.totalScore));
  }

  private async poll(tokens: string[]): Promise<Judge0Result[]> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const response = await firstValueFrom(
        this.http.get<{ submissions: Judge0Result[] }>(`${this.judge0Url}/submissions/batch`, {
          params: { tokens: tokens.join(','), base64_encoded: true, fields: FIELDS },
          headers: this.headers,
        }),
      );
      const byToken = new Map(response.data.submissions.map((item) => [item.token, item]));
      const ordered = tokens.map((token) => byToken.get(token));
      const finished = ordered.every((item) => item && item.status.id > 2);
      if (finished) return ordered as Judge0Result[];
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error('Hết thời gian chờ kết quả từ Judge0.');
  }

  private summarize(results: Judge0Result[], totalScore: number): JudgeResult {
    const passed = results.filter((item) => item.status.id === 3).length;
    const firstFailure = results.find((item) => item.status.id !== 3);
    const compileFailure = results.find((item) => item.status.id === 6);

    let status: SubmissionStatus = 'AC';
    if (compileFailure) status = 'CE';
    else if (firstFailure) status = mapJudge0Status(firstFailure.status.id);

    const times = results.map((item) => Number(item.time ?? 0));
    const memories = results.map((item) => item.memory ?? 0);
    const failure = compileFailure ?? firstFailure;

    return {
      status,
      executionTime: Math.max(0, ...times),
      memoryUsed: Math.max(0, ...memories),
      score: Math.round((totalScore * passed) / results.length),
      passedTests: passed,
      totalTests: results.length,
      compileOutput: failure
        ? status === 'CE'
          ? fromBase64(failure.compile_output)
          : fromBase64(failure.stderr)
        : null,
    };
  }
}
