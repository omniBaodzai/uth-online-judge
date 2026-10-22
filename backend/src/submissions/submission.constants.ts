export const JUDGE_QUEUE = 'judge-queue';

export const SUBMISSION_STATUSES = ['PENDING', 'JUDGING', 'AC', 'WA', 'TLE', 'MLE', 'RE', 'CE'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// Tên hiển thị trên giao diện -> language_id của Judge0 CE
export const LANGUAGE_IDS_BY_NAME: Record<string, number> = {
  c: 50,
  c17: 50,
  'c++': 54,
  'c++17': 54,
  'c++20': 54,
  cpp: 54,
  java: 62,
  'java 17': 62,
  java17: 62,
  python: 71,
  python3: 71,
  'python 3': 71,
  javascript: 63,
  js: 63,
  'c# 12': 51,
  csharp: 51,
  'go 1.23': 60,
  go: 60,
  'rust 1.82': 73,
  rust: 73,
};

export function resolveLanguageId(languageId?: number, language?: string): number | null {
  if (typeof languageId === 'number') return languageId;
  if (!language) return null;
  return LANGUAGE_IDS_BY_NAME[language.trim().toLowerCase()] ?? null;
}

// Ánh xạ status.id của Judge0 sang trạng thái nội bộ
export function mapJudge0Status(statusId: number): SubmissionStatus {
  if (statusId === 3) return 'AC';
  if (statusId === 4) return 'WA';
  if (statusId === 5) return 'TLE';
  if (statusId === 6) return 'CE';
  return 'RE';
}
