export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

// Trạng thái của người dùng hiện tại với một bài tập (khớp với giao diện frontend).
export type UserProblemStatus = 'solved' | 'wrong' | 'unsolved';

export interface TagSummary {
  name: string;
  slug: string;
}

export interface ProblemListItem {
  code: string;
  title: string;
  difficulty: Difficulty;
  scoringEnabled: boolean;
  points: number;
  acceptanceRate: number;
  acCount: number;
  status: UserProblemStatus;
  hasSolution: boolean;
  publishedAt: string | null;
  tags: TagSummary[];
}

export interface ProblemListResult {
  items: ProblemListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProblemExample {
  input: string;
  output: string;
}

export interface LanguageSummary {
  slug: string;
  name: string;
  version: string | null;
}

export interface ProblemDetail {
  code: string;
  title: string;
  statement: string;
  inputDescription: string | null;
  outputDescription: string | null;
  constraints: string | null;
  difficulty: Difficulty;
  scoringEnabled: boolean;
  points: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  author: string | null;
  publishedAt: string | null;
  status: UserProblemStatus;
  hasSolution: boolean;
  tags: TagSummary[];
  // Chỉ gồm test case được đánh dấu is_sample; test ẩn không bao giờ rời khỏi backend.
  examples: ProblemExample[];
  languages: LanguageSummary[];
}

export const PROBLEM_SORT_FIELDS = ['code', 'title', 'points', 'difficulty', 'publishedAt', 'createdAt'] as const;
export type ProblemSortField = (typeof PROBLEM_SORT_FIELDS)[number];
export const USER_PROBLEM_STATUSES: readonly UserProblemStatus[] = ['solved', 'wrong', 'unsolved'];

export interface ProblemListQuery {
  page: number;
  pageSize: number;
  search?: string;
  tags?: string[];
  status?: UserProblemStatus;
  sort: ProblemSortField;
  order: 'asc' | 'desc';
}
