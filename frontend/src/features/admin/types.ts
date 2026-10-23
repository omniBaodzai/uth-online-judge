export type AdminProblemStatus = 'draft' | 'published' | 'archived'
export type AdminDifficulty = 'easy' | 'medium' | 'hard'
export type TestCaseKind = 'sample' | 'hidden'

export type ProblemExample = {
  id: string
  input: string
  output: string
}

export type AdminProblem = {
  id: string
  code: string
  title: string
  summary: string | null
  statement: string
  difficulty: AdminDifficulty
  tags: string[]
  languages: string[]
  inputDescription: string
  outputDescription: string
  constraints: string
  timeLimitSeconds: number
  memoryLimitMb: number
  scoringEnabled: boolean
  score: number
  examples: ProblemExample[]
  status: AdminProblemStatus
  updatedAt: string
}

export type AdminTestCase = {
  id: string
  name: string
  input: string
  expectedOutput: string
  kind: TestCaseKind
  points: number | null
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

export type ProblemDraft = Omit<AdminProblem, 'id' | 'updatedAt'>

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
