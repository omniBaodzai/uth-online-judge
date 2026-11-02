export type StudentContestTimeStatus = 'UPCOMING' | 'ONGOING' | 'ENDED';
export type StudentRegistrationStatus = 'REGISTERED' | 'CANCELLED';
export type StudentContestParticipantStatus = 'registered' | 'participated';
export type StudentContestParticipantStatusFilter =
  | 'all'
  | StudentContestParticipantStatus;
export type StudentContestSortField =
  | 'startsAt'
  | 'endsAt'
  | 'title'
  | 'participantCount';

export type StudentContestListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  timeStatus?: StudentContestTimeStatus;
  sort: StudentContestSortField;
  order: 'asc' | 'desc';
};

export type StudentContestProblem = {
  problemId: string;
  problemCode: string;
  problemTitle: string;
  position: number;
  maxScore: number;
};

export type StudentContestListItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timeStatus: StudentContestTimeStatus;
  allowRegistration: boolean;
  canRegister: boolean;
  isRegistered: boolean;
  participantCount: number;
};

export type StudentContestDetail = StudentContestListItem & {
  rules: string | null;
  isRegistered: boolean;
  registrationStatus: StudentRegistrationStatus | null;
  problems: StudentContestProblem[];
};

export type StudentContestPage = {
  items: StudentContestListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type StudentContestParticipantsQuery = {
  page: number;
  pageSize: 10 | 20 | 50;
  search?: string;
  status: StudentContestParticipantStatusFilter;
};

export type StudentContestParticipant = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  registeredAt: string;
  status: StudentContestParticipantStatus;
};

export type StudentContestParticipantsPage = {
  items: StudentContestParticipant[];
  total: number;
  participantCount: number;
  page: number;
  pageSize: 10 | 20 | 50;
};

export type ContestRegistration = {
  contestId: string;
  registrationStatus: StudentRegistrationStatus;
  registeredAt: string;
};

export type StudentContestStatistics = {
  totalParticipants: number;
  totalProblems: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
  wrongAnswerSubmissions: number;
  timeLimitSubmissions: number;
  runtimeErrorSubmissions: number;
  pendingSubmissions: number;
  otherSubmissions: number;
  activeSubmitters: number;
  solvedParticipants: number;
  statusCounts: Array<{ status: string; count: number }>;
  problemStatistics: Array<{
    problemId: string;
    problemCode: string;
    problemTitle: string;
    totalSubmissions: number;
    acceptedSubmissions: number;
    statusCounts: Array<{ status: string; count: number }>;
  }>;
  languageStatistics: Array<{
    languageId: string;
    languageName: string;
    totalSubmissions: number;
    acceptedSubmissions: number;
    statusCounts: Array<{ status: string; count: number }>;
  }>;
};

export type StudentContestLeaderboardQuery = {
  page: number;
  pageSize: 10 | 20 | 50;
  search?: string;
};

export type StudentContestSubmissionsQuery = {
  page: number;
  pageSize: 10 | 20 | 50;
  search?: string;
  status?: string;
  language?: string;
};

export type StudentContestSubmissionItem = {
  id: string;
  status: string;
  submittedAt: string;
  username: string | null;
  problemCode: string;
  problemTitle: string;
  language: string;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  canViewDetails: boolean;
};

export type StudentContestSubmissionsPage = {
  items: StudentContestSubmissionItem[];
  total: number;
  page: number;
  pageSize: 10 | 20 | 50;
  statistics: {
    total: number;
    accepted: number;
    acceptanceRate: number;
    verdictCounts: Record<string, number>;
  };
  filters: { languages: string[] };
  search?: string;
};

export type StudentContestLeaderboardEntry = {
  rank: number;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  totalScore: number;
  acceptedProblems: number;
  totalProblems: number;
  elapsedSeconds: number | null;
};

export type StudentContestLeaderboardPage = {
  items: StudentContestLeaderboardEntry[];
  total: number;
  totalParticipants: number;
  page: number;
  pageSize: number;
};
