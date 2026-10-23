// Raw shapes returned by Judge0 CE v1.13.1.
export interface Judge0RawStatus {
  id: number;
  description: string;
}

export interface Judge0RawSubmission {
  token?: string;
  status?: Judge0RawStatus | null;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  wall_time?: string | number | null;
  memory?: number | null;
  created_at?: string | null;
  finished_at?: string | null;
}

// Internal application models.
export enum Judge0Verdict {
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
  WrongAnswer = 'WRONG_ANSWER',
  TimeLimitExceeded = 'TIME_LIMIT_EXCEEDED',
  CompilationError = 'COMPILATION_ERROR',
  RuntimeError = 'RUNTIME_ERROR',
  InternalError = 'INTERNAL_ERROR',
}

// Judge0 CE v1.13.1 status ids: 1 In Queue, 2 Processing, 3 Accepted, 4 Wrong Answer,
// 5 Time Limit Exceeded, 6 Compilation Error, 7-12 Runtime Error (SIGSEGV, SIGXFSZ,
// SIGFPE, SIGABRT, NZEC, Other), 13 Internal Error, 14 Exec Format Error.
export const JUDGE0_STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,
} as const;

export interface Judge0About {
  version: string;
}

export interface Judge0Language {
  id: number;
  name: string;
}

export interface CreateJudge0SubmissionInput {
  languageId: number;
  sourceCode: string;
  stdin?: string;
  expectedOutput?: string;
  cpuTimeLimitSeconds?: number;
  memoryLimitKb?: number;
}

export interface Judge0SubmissionResult {
  token: string;
  statusId: number;
  statusDescription: string;
  verdict: Judge0Verdict;
  isFinished: boolean;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  message: string | null;
  timeSeconds: number | null;
  wallTimeSeconds: number | null;
  memoryKb: number | null;
  submissionDurationMs: number | null;
}
