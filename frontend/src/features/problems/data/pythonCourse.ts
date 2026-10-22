import type { Problem } from '../data'
import type { ProblemDetail } from './problemDetails'

type CourseProblem = Problem & { detail: ProblemDetail }

const limits = { timeLimit: '1.0 giây', memoryLimit: '256 MB', source: 'Khóa Python cơ bản UTH' }

const courseProblems: CourseProblem[] = [
  {
    id: 'PY001', title: '[Nhập xuất]. Bài 1. Xin chào Python', tags: ['Python cơ bản'], topic: 'Nhập xuất',
    score: 5, acceptance: 91.3, acceptedCount: 1180, difficulty: 'Dễ', status: 'solved', hasEditorial: true,
    detail: {
      description: ['Viết chương trình in ra dòng chữ "Hello UTH" ra màn hình.'],
      input: 'Không có dữ liệu đầu vào.', output: 'In ra đúng một dòng: Hello UTH.', constraints: ['Không có giới hạn đặc biệt.'],
      examples: [{ input: '', output: 'Hello UTH' }], ...limits,
    },
  },
  {
    id: 'PY002', title: '[Nhập xuất]. Bài 2. Tổng và hiệu hai số', tags: ['Python cơ bản', 'Toán học'], topic: 'Nhập xuất',
    score: 5, acceptance: 87.6, acceptedCount: 1104, difficulty: 'Dễ', status: 'solved', hasEditorial: true,
    detail: {
      description: ['Cho hai số nguyên a và b. In ra tổng a + b và hiệu a - b trên hai dòng.'],
      input: 'Một dòng gồm hai số nguyên a, b cách nhau bởi dấu cách.', output: 'Dòng 1 là a + b, dòng 2 là a - b.',
      constraints: ['-10^9 ≤ a, b ≤ 10^9'], examples: [{ input: '7 3', output: '10\n4' }], ...limits,
    },
  },
  {
    id: 'PY003', title: '[Kiểu dữ liệu-if else]. Bài 3. Chẵn hay lẻ', tags: ['Python cơ bản', 'Rẽ nhánh'], topic: 'Kiểu dữ liệu-if else',
    score: 5, acceptance: 84.9, acceptedCount: 1051, difficulty: 'Dễ', status: 'solved', hasEditorial: false,
    detail: {
      description: ['Cho số nguyên n. In EVEN nếu n là số chẵn, ngược lại in ODD.'],
      input: 'Một số nguyên n.', output: 'In EVEN hoặc ODD.', constraints: ['-10^9 ≤ n ≤ 10^9'],
      examples: [{ input: '4', output: 'EVEN' }, { input: '7', output: 'ODD' }], ...limits,
    },
  },
  {
    id: 'PY004', title: '[Kiểu dữ liệu-if else]. Bài 4. Số lớn nhất trong ba số', tags: ['Python cơ bản', 'Rẽ nhánh'], topic: 'Kiểu dữ liệu-if else',
    score: 10, acceptance: 79.2, acceptedCount: 968, difficulty: 'Dễ', status: 'solved', hasEditorial: false,
    detail: {
      description: ['Cho ba số nguyên a, b, c. Tìm và in ra số lớn nhất.'],
      input: 'Một dòng gồm ba số nguyên cách nhau bởi dấu cách.', output: 'In ra số lớn nhất.', constraints: ['-10^9 ≤ a, b, c ≤ 10^9'],
      examples: [{ input: '3 9 5', output: '9' }], ...limits,
    },
  },
  {
    id: 'PY005', title: '[Kiểu dữ liệu-if else]. Bài 5. Phân loại điểm', tags: ['Python cơ bản', 'Rẽ nhánh'], topic: 'Kiểu dữ liệu-if else',
    score: 10, acceptance: 72.4, acceptedCount: 901, difficulty: 'Dễ', status: 'attempted', hasEditorial: false,
    detail: {
      description: ['Cho điểm số x (0 ≤ x ≤ 10). In "Gioi" nếu x ≥ 8, "Kha" nếu 6.5 ≤ x < 8, "Trung binh" nếu 5 ≤ x < 6.5, ngược lại in "Yeu".'],
      input: 'Một số thực x.', output: 'In ra xếp loại tương ứng.', constraints: ['0 ≤ x ≤ 10'],
      examples: [{ input: '8.5', output: 'Gioi' }, { input: '4.9', output: 'Yeu' }], ...limits,
    },
  },
  {
    id: 'PY006', title: '[Kiểu dữ liệu-if else]. Bài 9. Kiểm tra năm nhuận', tags: ['Python cơ bản', 'Rẽ nhánh'], topic: 'Kiểu dữ liệu-if else',
    score: 10, acceptance: 61.8, acceptedCount: 812, difficulty: 'Dễ', status: 'solved', hasEditorial: true,
    detail: {
      description: [
        'Một năm được gọi là năm nhuận nếu nó chia hết cho 400, hoặc chia hết cho 4 nhưng không chia hết cho 100.',
        'Cho năm y, hãy kiểm tra y có phải năm nhuận hay không.',
      ],
      input: 'Một số nguyên dương y.', output: 'In YES nếu y là năm nhuận, ngược lại in NO.', constraints: ['1 ≤ y ≤ 10^9'],
      examples: [{ input: '2024', output: 'YES' }, { input: '1900', output: 'NO' }], ...limits,
    },
  },
  {
    id: 'PY007', title: '[Vòng lặp]. Bài 10. Tổng các số từ 1 đến n', tags: ['Python cơ bản', 'Vòng lặp'], topic: 'Vòng lặp',
    score: 10, acceptance: 77.5, acceptedCount: 877, difficulty: 'Dễ', status: 'solved', hasEditorial: false,
    detail: {
      description: ['Cho số nguyên dương n. Tính tổng 1 + 2 + ... + n.'],
      input: 'Một số nguyên n.', output: 'In ra tổng cần tìm.', constraints: ['1 ≤ n ≤ 10^6'],
      examples: [{ input: '10', output: '55' }], ...limits,
    },
  },
  {
    id: 'PY008', title: '[Vòng lặp]. Bài 11. Đếm chữ số', tags: ['Python cơ bản', 'Vòng lặp'], topic: 'Vòng lặp',
    score: 10, acceptance: 66.1, acceptedCount: 744, difficulty: 'Dễ', status: 'unsolved', hasEditorial: false,
    detail: {
      description: ['Cho số nguyên không âm n. Đếm số chữ số của n.'],
      input: 'Một số nguyên n.', output: 'In ra số chữ số của n.', constraints: ['0 ≤ n ≤ 10^18'],
      examples: [{ input: '12345', output: '5' }, { input: '0', output: '1' }], ...limits,
    },
  },
  {
    id: 'PY009', title: '[Vòng lặp]. Bài 12. Số nguyên tố', tags: ['Python cơ bản', 'Số học'], topic: 'Vòng lặp',
    score: 15, acceptance: 52.7, acceptedCount: 633, difficulty: 'Trung bình', status: 'unsolved', hasEditorial: true,
    detail: {
      description: ['Cho số nguyên n. Kiểm tra n có phải số nguyên tố hay không.'],
      input: 'Một số nguyên n.', output: 'In YES nếu n là số nguyên tố, ngược lại in NO.', constraints: ['1 ≤ n ≤ 10^9'],
      examples: [{ input: '17', output: 'YES' }, { input: '21', output: 'NO' }], ...limits,
    },
  },
  {
    id: 'PY010', title: '[Chuỗi]. Bài 13. Đảo ngược chuỗi', tags: ['Python cơ bản', 'Chuỗi'], topic: 'Chuỗi',
    score: 10, acceptance: 74.3, acceptedCount: 790, difficulty: 'Dễ', status: 'solved', hasEditorial: false,
    detail: {
      description: ['Cho một chuỗi s. In ra chuỗi s sau khi đảo ngược thứ tự các ký tự.'],
      input: 'Một dòng chứa chuỗi s.', output: 'In ra chuỗi đã đảo ngược.', constraints: ['1 ≤ |s| ≤ 10^5'],
      examples: [{ input: 'uth', output: 'htu' }], ...limits,
    },
  },
  {
    id: 'PY011', title: '[Chuỗi]. Bài 14. Đếm từ trong câu', tags: ['Python cơ bản', 'Chuỗi'], topic: 'Chuỗi',
    score: 15, acceptance: 58.9, acceptedCount: 602, difficulty: 'Trung bình', status: 'unsolved', hasEditorial: false,
    detail: {
      description: ['Cho một câu gồm các từ cách nhau bởi một hoặc nhiều dấu cách. Đếm số từ trong câu.'],
      input: 'Một dòng chứa câu cần xử lý.', output: 'In ra số từ.', constraints: ['1 ≤ độ dài câu ≤ 10^5'],
      examples: [{ input: 'hoc   lap trinh python', output: '4' }], ...limits,
    },
  },
  {
    id: 'PY012', title: '[Danh sách]. Bài 15. Tìm phần tử lớn thứ hai', tags: ['Python cơ bản', 'Danh sách'], topic: 'Danh sách',
    score: 20, acceptance: 41.6, acceptedCount: 455, difficulty: 'Trung bình', status: 'unsolved', hasEditorial: true,
    detail: {
      description: ['Cho dãy gồm n số nguyên. Tìm giá trị lớn thứ hai (khác giá trị lớn nhất) trong dãy.', 'Nếu không tồn tại, in ra -1.'],
      input: 'Dòng đầu là n. Dòng tiếp theo gồm n số nguyên.', output: 'In ra giá trị lớn thứ hai hoặc -1.',
      constraints: ['1 ≤ n ≤ 10^5', '-10^9 ≤ ai ≤ 10^9'], examples: [{ input: '5\n3 9 9 5 1', output: '5' }], ...limits,
    },
  },
]

export const pythonCourseProblems: Problem[] = courseProblems.map(({ detail, ...problem }) => {
  void detail
  return problem
})

export const pythonCourseDetails: Record<string, ProblemDetail> = Object.fromEntries(
  courseProblems.map((problem) => [problem.id, problem.detail]),
)
