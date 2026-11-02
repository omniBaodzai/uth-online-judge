export type StudentContestTimeStatus = 'UPCOMING' | 'ONGOING' | 'ENDED';
export type StudentRegistrationStatus = 'REGISTERED' | 'CANCELLED';
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

export type ContestRegistration = {
  contestId: string;
  registrationStatus: StudentRegistrationStatus;
  registeredAt: string;
};
