import { sampleProblems } from '../problems/data'

// Dữ liệu mẫu — thay bằng API khi backend sẵn sàng.
export type SubmissionVerdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE'
export type SubmissionLanguage = 'C++' | 'Java' | 'Python' | 'JavaScript'

export type Submission = {
  id: number
  verdict: SubmissionVerdict
  submittedAt: string
  coder: string
  problemCode: string
  problemTitle: string
  language: SubmissionLanguage
  timeMs: number | null
  memoryMb: number | null
}

export const verdictOptions: SubmissionVerdict[] = ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE']
export const languageOptions: SubmissionLanguage[] = ['C++', 'Java', 'Python', 'JavaScript']

// Màu dùng chung cho badge ở bảng và biểu đồ.
export const verdictMeta: Record<SubmissionVerdict, { name: string; color: string; background: string; chart: string }> = {
  AC: { name: 'Accepted', color: '#14693f', background: '#e3f6ec', chart: '#2e9e66' },
  WA: { name: 'Wrong Answer', color: '#a12626', background: '#fde7e7', chart: '#d95454' },
  TLE: { name: 'Time Limit Exceeded', color: '#8a5200', background: '#fff0d6', chart: '#e0a030' },
  MLE: { name: 'Memory Limit Exceeded', color: '#5b3ea8', background: '#ece6fa', chart: '#8c6fd6' },
  RE: { name: 'Runtime Error', color: '#9c3a00', background: '#fde9dc', chart: '#e8814a' },
  CE: { name: 'Compilation Error', color: '#455a5c', background: '#e8eeee', chart: '#8a9a9c' },
}

export const submissionPageSizes = [10, 20, 50]

const coders = ['minh.nguyen', 'thu.tran', 'khoa.le', 'an.pham', 'huy.vo', 'lan.dang', 'bao.huynh', 'tam.ngo']
// Phân bố cố định để số liệu ổn định giữa các lần chạy.
const verdictCycle: SubmissionVerdict[] = [
  'AC', 'AC', 'WA', 'AC', 'TLE', 'AC', 'WA', 'AC', 'RE', 'AC',
  'WA', 'AC', 'CE', 'AC', 'AC', 'MLE', 'WA', 'AC', 'TLE', 'AC',
]

const total = 125

export const sampleSubmissions: Submission[] = Array.from({ length: total }, (_, index) => {
  const verdict = verdictCycle[index % verdictCycle.length]
  const problem = sampleProblems[(index * 3) % sampleProblems.length]
  const date = new Date(2026, 9, 22, 14, 30, 0)
  date.setSeconds(date.getSeconds() - index * 1741)
  const noRun = verdict === 'CE'

  return {
    id: total - index,
    verdict,
    submittedAt: date.toISOString(),
    coder: coders[(index * 5) % coders.length],
    problemCode: problem.code,
    problemTitle: problem.title,
    language: languageOptions[(index * 7) % languageOptions.length],
    timeMs: noRun ? null : verdict === 'TLE' ? 1000 : 15 + ((index * 37) % 480),
    memoryMb: noRun ? null : verdict === 'MLE' ? 256 : Math.round((3 + ((index * 13) % 200) / 8) * 10) / 10,
  }
})

export function countVerdicts(list: Submission[]): Record<SubmissionVerdict, number> {
  const counts: Record<SubmissionVerdict, number> = { AC: 0, WA: 0, TLE: 0, MLE: 0, RE: 0, CE: 0 }
  for (const item of list) counts[item.verdict] += 1
  return counts
}
