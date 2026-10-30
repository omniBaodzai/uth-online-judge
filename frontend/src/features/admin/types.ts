export type AdminProblemStatus = 'draft' | 'published' | 'archived'
export type AdminDifficulty = 'easy' | 'medium' | 'hard'
export type TestCaseKind = 'sample' | 'hidden'

export type ProblemExample = {
  id: string
  input: string
  output: string
}

export type AdminProblemEditorial = {
  id: string
  title: string
  language: string
  sourceCode: string
}

export type AdminProblemEditorialDraft = Omit<AdminProblemEditorial, 'id'> & {
  id?: string
}

export type AdminProblem = {
  id: string
  code: string
  title: string
  summary: string | null
  illustrationUrl: string | null
  illustrationWidth: number
  illustrationAspectRatio: 'auto' | '16:9' | '4:3' | '1:1' | '3:2'
  illustrationAlignment: 'left' | 'center' | 'right'
  statement: string
  difficulty?: AdminDifficulty | null
  tags: string[]
  languages: string[]
  inputDescription: string
  outputDescription: string
  constraints: string
  timeLimitSeconds: number
  memoryLimitMb: number
  scoringEnabled: boolean
  score: number
  testCaseRevision: number
  examples: ProblemExample[]
  editorials: AdminProblemEditorial[]
  status: AdminProblemStatus
  updatedAt: string
}

export type AdminTestCase = {
  id: string
  name: string
  input: string
  expectedOutput: string
  kind: TestCaseKind
  points: 1
  position: number
}

export type AdminTestCaseDraft = {
  id?: string
  clientId: string
  name: string
  input: string
  expectedOutput: string
  kind: TestCaseKind
}

export type AdminTestCaseCollection = {
  revision: number
  cases: AdminTestCase[]
}

export type AdminProblemPage = {
  items: AdminProblem[]
  total: number
  page: number
  pageSize: number
}

export type AdminCatalog = {
  tags: string[]
  languages: string[]
}

export type AdminDashboard = {
  total: number
  published: number
  draft: number
  archived: number
  recent: AdminProblem[]
}

export type ProblemDraft = Omit<AdminProblem, 'id' | 'updatedAt' | 'examples' | 'testCaseRevision' | 'editorials'> & {
  testCases: AdminTestCaseDraft[]
  testCaseRevision: number
  editorials: AdminProblemEditorialDraft[]
}

export type AdminUserRole = 'STUDENT' | 'ADMIN'
export type AdminUserStatus = 'active' | 'inactive'
export type AdminUserAuthMethod = 'password' | 'google' | 'github'

export type AdminUser = {
  id: string
  username: string | null
  email: string
  fullName: string | null
  avatarUrl: string | null
  role: AdminUserRole
  isActive: boolean
  authMethods: AdminUserAuthMethod[]
  createdAt: string
  updatedAt: string
}

export type AdminUserPage = {
  items: AdminUser[]
  total: number
  page: number
  pageSize: number
}
