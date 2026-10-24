export type AdminProblemStatus = 'draft' | 'published' | 'archived';
export type AdminDifficulty = 'easy' | 'medium' | 'hard';

export type AdminProblemExample = {
  id: string;
  input: string;
  output: string;
};

export type AdminProblem = {
  id: string;
  code: string;
  title: string;
  summary: string | null;
  statement: string;
  difficulty: AdminDifficulty;
  tags: string[];
  languages: string[];
  inputDescription: string;
  outputDescription: string;
  constraints: string;
  timeLimitSeconds: number;
  memoryLimitMb: number;
  scoringEnabled: boolean;
  score: number;
  testCaseRevision: number;
  examples: AdminProblemExample[];
  status: AdminProblemStatus;
  updatedAt: string;
};

export type AdminTestCase = {
  id: string;
  name: string;
  input: string;
  expectedOutput: string;
  kind: 'sample' | 'hidden';
  points: 1;
  position: number;
};

export type AdminTestCaseCollection = {
  revision: number;
  cases: AdminTestCase[];
};

export type AdminProblemListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: AdminProblemStatus;
  difficulty?: AdminDifficulty;
};

export type AdminProblemPage = {
  items: AdminProblem[];
  total: number;
  page: number;
  pageSize: number;
};
