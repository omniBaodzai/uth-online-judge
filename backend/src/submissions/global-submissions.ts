export interface GlobalSubmissionItem {
  id: string;
  status: string;
  submittedAt: string;
  username: string | null;
  problemCode: string;
  problemTitle: string;
  language: string;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  // Chi tiết bài nộp (kèm mã nguồn) chỉ dành cho chủ sở hữu.
  canViewDetails: boolean;
}

export interface GlobalSubmissionStatistics {
  total: number;
  accepted: number;
  acceptanceRate: number;
  verdictCounts: Record<string, number>;
}

export interface GlobalSubmissionPage {
  items: GlobalSubmissionItem[];
  total: number;
  page: number;
  pageSize: number;
  statistics: GlobalSubmissionStatistics;
  filters: { languages: string[] };
  // Chỉ có khi lọc theo một bài tập.
  problem: { code: string; title: string } | null;
}

export interface GlobalSubmissionQuery {
  page: number;
  pageSize: number;
  q?: string;
  problemCode?: string;
  status?: string;
  language?: string;
  userId?: string;
}

// Vô hiệu hóa ký tự đại diện của ILIKE để từ khóa người dùng chỉ được hiểu theo nghĩa đen.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function buildGlobalStatistics(rows: Array<{ status: string; count: number | string }>): GlobalSubmissionStatistics {
  const verdictCounts: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    const count = Number(row.count);
    if (!Number.isFinite(count) || count <= 0) continue;
    verdictCounts[row.status] = (verdictCounts[row.status] ?? 0) + count;
    total += count;
  }
  const accepted = verdictCounts.ACCEPTED ?? 0;
  return {
    total,
    accepted,
    acceptanceRate: total === 0 ? 0 : Math.round((accepted / total) * 1000) / 10,
    verdictCounts,
  };
}
