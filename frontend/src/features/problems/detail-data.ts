import { latestProblems, sampleProblems, type ProblemStatus } from './data'

// Dữ liệu mẫu — thay bằng API khi backend sẵn sàng.
export type ProblemExample = {
  input: string
  output: string
  explanation?: string
}

export type ProblemComment = {
  id: string
  author: string
  postedAt: string
  content: string
}

export type ProblemDetail = {
  code: string
  title: string
  status: ProblemStatus
  description: string[]
  input: string[]
  constraints: string[]
  output: string[]
  examples: ProblemExample[]
  points: number
  timeLimit: string
  memoryLimit: string
  author: string
  topics: string[]
  languages: string[]
  comments: ProblemComment[]
}

export const reportTypes = [
  'Đề bài sai hoặc thiếu thông tin',
  'Dữ liệu kiểm thử không chính xác',
  'Lỗi hiển thị',
  'Vấn đề khác',
]

const sharedComments: ProblemComment[] = [
  {
    id: 'c1',
    author: 'minh.nguyen',
    postedAt: '2026-10-20T09:15:00+07:00',
    content: 'Bài này phù hợp để làm quen với nhập xuất dữ liệu. Nhớ dùng kiểu số nguyên 64 bit nhé!',
  },
  {
    id: 'c2',
    author: 'thu.tran',
    postedAt: '2026-10-19T20:40:00+07:00',
    content: 'Mình bị sai test cuối vì tràn số, đổi sang long long là qua.',
  },
]

const specific: Record<string, Partial<ProblemDetail>> = {
  UTH001: {
    description: [
      'Cho hai số nguyên A và B. Hãy tính và in ra tổng của hai số này.',
      'Đây là bài tập làm quen với việc đọc dữ liệu từ đầu vào chuẩn và in kết quả ra đầu ra chuẩn.',
    ],
    input: ['Một dòng duy nhất chứa hai số nguyên A và B, cách nhau bởi một dấu cách.'],
    constraints: ['−10^18 ≤ A, B ≤ 10^18', 'Kết quả luôn nằm trong phạm vi số nguyên 64 bit có dấu.'],
    output: ['In ra một số nguyên duy nhất là tổng A + B.'],
    examples: [
      { input: '3 5', output: '8', explanation: '3 + 5 = 8.' },
      { input: '-10 4', output: '-6' },
    ],
    topics: ['Toán học'],
  },
  UTH002: {
    description: ['Cho một xâu ký tự S. Hãy in ra xâu S sau khi đảo ngược thứ tự các ký tự.'],
    input: ['Một dòng chứa xâu S gồm các chữ cái Latin và chữ số, không chứa dấu cách.'],
    constraints: ['1 ≤ |S| ≤ 10^5'],
    output: ['In ra xâu đã được đảo ngược.'],
    examples: [{ input: 'uth2026', output: '6202htu' }],
    topics: ['Chuỗi'],
  },
}

export function getProblemDetail(code: string): ProblemDetail | null {
  const base = sampleProblems.find((p) => p.code === code)
  const latest = latestProblems.find((p) => p.code === code)
  if (!base && !latest) return null

  return {
    code,
    title: base?.title ?? latest?.title ?? code,
    status: base?.status ?? 'unsolved',
    points: base?.points ?? 100,
    description: [
      'Nội dung đề bài đang được cập nhật. Đây là dữ liệu mẫu dùng để minh họa giao diện trang chi tiết bài tập.',
    ],
    input: ['Dòng đầu tiên chứa số nguyên N. Dòng thứ hai chứa N số nguyên cách nhau bởi dấu cách.'],
    constraints: ['1 ≤ N ≤ 10^5', '|a_i| ≤ 10^9'],
    output: ['In ra kết quả của bài toán trên một dòng.'],
    examples: [{ input: '3\n1 2 3', output: '6', explanation: 'Ví dụ minh họa.' }],
    timeLimit: '1 giây',
    memoryLimit: '256 MB',
    author: 'Admin UTH',
    topics: ['Mảng'],
    languages: ['C++', 'Java', 'Python', 'JavaScript'],
    comments: sharedComments,
    ...specific[code],
  }
}
