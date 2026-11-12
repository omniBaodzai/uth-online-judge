export type AdminDashboardSubmissionScope = 'GLOBAL' | 'ORGANIZATION';

export type AdminDashboardDailyCount = {
  date: string;
  count: number;
};

export type AdminDashboardStatistics = {
  timezone: 'Asia/Ho_Chi_Minh';
  days: 7 | 30 | 90;
  submissionScope: AdminDashboardSubmissionScope;
  submissions: {
    total: number;
    daily: AdminDashboardDailyCount[];
  };
  users: {
    total: number;
    daily: AdminDashboardDailyCount[];
  };
};
