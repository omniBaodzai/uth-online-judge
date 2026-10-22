import { pythonCourseDetails } from './pythonCourse'
export type ProblemExample = {
  input: string
  output: string
}

export type ProblemDetail = {
  description: string[]
  input: string
  output: string
  constraints: string[]
  examples: ProblemExample[]
  source: string
  timeLimit: string
  memoryLimit: string
}

const standardLimits = { timeLimit: '1.0 giây', memoryLimit: '256 MB' }

export const problemDetails: Record<string, ProblemDetail> = {
  ...pythonCourseDetails,
  UTH001: {
    description: [
      'Cho hai số nguyên a và b. Hãy tính tổng của hai số đó.',
      'Bài tập giúp bạn làm quen với thao tác đọc dữ liệu từ đầu vào chuẩn, thực hiện phép tính và in kết quả ra đầu ra chuẩn.',
    ],
    input: 'Một dòng chứa hai số nguyên a và b, cách nhau bởi một dấu cách.',
    output: 'In ra một số nguyên duy nhất là tổng a + b.',
    constraints: ['-10^9 ≤ a, b ≤ 10^9', 'Dữ liệu đầu vào luôn hợp lệ.'],
    examples: [{ input: '3 5', output: '8' }, { input: '-12 7', output: '-5' }],
    source: 'Làm quen Online Judge',
    ...standardLimits,
  },
  UTH002: {
    description: ['Cho số nguyên không âm n. Hãy tìm số Fibonacci thứ n, với F0 = 0, F1 = 1 và Fn = F(n-1) + F(n-2).'],
    input: 'Một số nguyên n.', output: 'In ra Fn.', constraints: ['0 ≤ n ≤ 90'],
    examples: [{ input: '10', output: '55' }], source: 'UTH Online Judge', ...standardLimits,
  },
  UTH003: {
    description: ['Cho một chuỗi s chỉ gồm các chữ cái tiếng Anh thường. Kiểm tra chuỗi có đối xứng hay không.'],
    input: 'Một dòng chứa chuỗi s.', output: 'In YES nếu s đối xứng, ngược lại in NO.', constraints: ['1 ≤ độ dài s ≤ 10^5'],
    examples: [{ input: 'level', output: 'YES' }, { input: 'uth', output: 'NO' }], source: 'UTH Online Judge', ...standardLimits,
  },
  UTH004: {
    description: ['Cho đồ thị vô hướng không trọng số gồm n đỉnh, m cạnh và hai đỉnh s, t. Tìm số cạnh ít nhất trên đường đi từ s đến t.'],
    input: 'Dòng đầu gồm n, m. Tiếp theo là m cạnh u, v. Dòng cuối gồm s, t.',
    output: 'In độ dài đường đi ngắn nhất; in -1 nếu không tồn tại đường đi.',
    constraints: ['1 ≤ n ≤ 2×10^5', '0 ≤ m ≤ 2×10^5', 'Các đỉnh được đánh số từ 1 đến n.'],
    examples: [{ input: '5 5\n1 2\n1 3\n2 4\n3 4\n4 5\n1 5', output: '3' }], source: 'UTH Graph Series', timeLimit: '2.0 giây', memoryLimit: '256 MB',
  },
  UTH005: {
    description: ['Cho mảng tăng dần gồm n số nguyên và giá trị x. Tìm vị trí đầu tiên của x trong mảng bằng tìm kiếm nhị phân.'],
    input: 'Dòng đầu gồm n và x. Dòng tiếp theo gồm n số nguyên tăng dần.',
    output: 'In chỉ số 0-based đầu tiên của x; in -1 nếu không tìm thấy.', constraints: ['1 ≤ n ≤ 10^6', '-10^9 ≤ x, ai ≤ 10^9'],
    examples: [{ input: '6 7\n1 3 5 7 9 11', output: '3' }], source: 'UTH Online Judge', ...standardLimits,
  },
  UTH006: {
    description: ['Cho dãy số nguyên a. Hãy tìm độ dài lớn nhất của một dãy con tăng nghiêm ngặt, không yêu cầu các phần tử liên tiếp.'],
    input: 'Dòng đầu là n. Dòng tiếp theo gồm n số nguyên của dãy.', output: 'In độ dài dãy con tăng nghiêm ngặt dài nhất.',
    constraints: ['1 ≤ n ≤ 2×10^5', '-10^9 ≤ ai ≤ 10^9'], examples: [{ input: '8\n10 9 2 5 3 7 101 18', output: '4' }], source: 'UTH Dynamic Programming', timeLimit: '2.0 giây', memoryLimit: '256 MB',
  },
  UTH007: {
    description: ['Cho một đồ thị vô hướng gồm n đỉnh và m cạnh. Hãy đếm số thành phần liên thông của đồ thị.'],
    input: 'Dòng đầu gồm n và m. Mỗi dòng trong m dòng tiếp theo chứa hai đầu mút u, v của một cạnh.',
    output: 'In số thành phần liên thông.', constraints: ['1 ≤ n ≤ 2×10^5', '0 ≤ m ≤ 2×10^5'],
    examples: [{ input: '5 3\n1 2\n2 3\n4 5', output: '2' }], source: 'UTH Graph Series', timeLimit: '2.0 giây', memoryLimit: '256 MB',
  },
  UTH008: {
    description: ['Cho hai số nguyên không âm a và b. Tính ước chung lớn nhất của chúng.'],
    input: 'Một dòng chứa hai số nguyên a và b.', output: 'In ra gcd(a, b).', constraints: ['0 ≤ a, b ≤ 10^18', 'Không đồng thời a = b = 0.'],
    examples: [{ input: '48 18', output: '6' }], source: 'Làm quen Online Judge', ...standardLimits,
  },
  UTH009: {
    description: ['Chuỗi chỉ gồm các ký tự ngoặc (), [], {} được gọi là hợp lệ nếu mọi ngoặc mở được đóng đúng loại và đúng thứ tự. Hãy kiểm tra chuỗi s.'],
    input: 'Một dòng chứa chuỗi s.', output: 'In YES nếu chuỗi ngoặc hợp lệ, ngược lại in NO.', constraints: ['1 ≤ độ dài s ≤ 2×10^5'],
    examples: [{ input: '([]{})', output: 'YES' }, { input: '([)]', output: 'NO' }], source: 'UTH Data Structures', ...standardLimits,
  },
  UTH010: {
    description: ['Có n loại đồng xu với mệnh giá cho trước và số lượng mỗi loại không giới hạn. Tìm số đồng xu ít nhất để tạo tổng S; nếu không thể, trả về -1.'],
    input: 'Dòng đầu gồm n và S. Dòng tiếp theo gồm n mệnh giá dương.', output: 'In số đồng xu ít nhất hoặc -1 nếu không thể tạo tổng S.',
    constraints: ['1 ≤ n ≤ 100', '1 ≤ S ≤ 10^5', '1 ≤ ai ≤ 10^4'], examples: [{ input: '3 11\n1 5 7', output: '3' }], source: 'UTH Dynamic Programming', timeLimit: '2.0 giây', memoryLimit: '256 MB',
  },
  UTH011: {
    description: ['Có n sự kiện, mỗi sự kiện có thời điểm bắt đầu và kết thúc. Hãy chọn nhiều sự kiện nhất sao cho không có hai sự kiện được chọn chồng lấn thời gian.'],
    input: 'Dòng đầu là n. Mỗi dòng tiếp theo gồm thời điểm bắt đầu và kết thúc.', output: 'In số sự kiện nhiều nhất có thể tham gia.',
    constraints: ['1 ≤ n ≤ 2×10^5', '0 ≤ bắt đầu < kết thúc ≤ 10^9'], examples: [{ input: '4\n1 3\n2 5\n4 7\n6 9', output: '2' }], source: 'UTH Greedy Series', ...standardLimits,
  },
  UTH012: {
    description: ['Cho đồ thị vô hướng liên thông có trọng số. Hãy tìm tổng trọng số nhỏ nhất của một cây khung nối tất cả các đỉnh.'],
    input: 'Dòng đầu gồm n, m. Mỗi dòng tiếp theo gồm u, v, w mô tả cạnh và trọng số.', output: 'In tổng trọng số cây khung nhỏ nhất.',
    constraints: ['1 ≤ n ≤ 2×10^5', 'n-1 ≤ m ≤ 3×10^5', '1 ≤ w ≤ 10^9'], examples: [{ input: '4 5\n1 2 1\n2 3 2\n3 4 3\n1 4 8\n1 3 4', output: '6' }], source: 'UTH Graph Series', timeLimit: '2.0 giây', memoryLimit: '256 MB',
  },
  UTH013: {
    description: ['Cho mảng số nguyên và q truy vấn. Mỗi truy vấn yêu cầu tính tổng các phần tử trong đoạn chỉ số [l, r].'],
    input: 'Dòng đầu gồm n, q. Dòng tiếp theo gồm n số nguyên. Mỗi truy vấn gồm l, r.', output: 'Với mỗi truy vấn, in tổng đoạn tương ứng trên một dòng.',
    constraints: ['1 ≤ n, q ≤ 2×10^5', '-10^9 ≤ ai ≤ 10^9', '1 ≤ l ≤ r ≤ n'], examples: [{ input: '5 3\n1 2 3 4 5\n1 3\n2 5\n4 4', output: '6\n14\n4' }], source: 'UTH Data Structures', timeLimit: '2.0 giây', memoryLimit: '256 MB',
  },
  UTH014: {
    description: ['Cho một hoán vị các số từ 1 đến n. Hãy tìm hoán vị kế tiếp theo thứ tự từ điển.'],
    input: 'Dòng đầu là n. Dòng tiếp theo là hoán vị gồm n số.', output: 'In hoán vị kế tiếp. Nếu đang là hoán vị cuối cùng, in hoán vị đầu tiên.',
    constraints: ['1 ≤ n ≤ 10^5'], examples: [{ input: '3\n1 3 2', output: '2 1 3' }], source: 'UTH Combinatorics', ...standardLimits,
  },
  UTH015: {
    description: ['Cho bản đồ dạng lưới gồm các ô trống và vật cản. Hai ô trống kề cạnh nhau có thể đi qua. Đếm số vùng trống liên thông.'],
    input: 'Dòng đầu gồm n, m. Tiếp theo là n dòng, mỗi dòng m ký tự . hoặc #.', output: 'In số vùng trống liên thông.',
    constraints: ['1 ≤ n, m ≤ 2000', 'Tổng số ô không vượt quá 2×10^6'], examples: [{ input: '4 5\n..##.\n.#...\n##..#\n...##', output: '3' }], source: 'UTH Graph Series', timeLimit: '2.0 giây', memoryLimit: '256 MB',
  },
  UTH016: {
    description: ['Cho mảng số nguyên và q truy vấn. Với mỗi truy vấn x, hãy tính tổng các phần tử từ đầu mảng đến vị trí x.'],
    input: 'Dòng đầu gồm n, q. Dòng tiếp theo gồm n số nguyên. Mỗi truy vấn là một chỉ số x.', output: 'In tổng tiền tố đến x cho mỗi truy vấn.',
    constraints: ['1 ≤ n, q ≤ 2×10^5', '-10^9 ≤ ai ≤ 10^9', '1 ≤ x ≤ n'], examples: [{ input: '5 3\n2 4 1 3 5\n1\n3\n5', output: '2\n7\n15' }], source: 'UTH Online Judge', ...standardLimits,
  },
  UTH017: {
    description: ['Cho hai chuỗi s và t. Tìm độ dài dãy con chung dài nhất của hai chuỗi, trong đó các ký tự được giữ nguyên thứ tự nhưng không cần liên tiếp.'],
    input: 'Dòng đầu chứa chuỗi s, dòng thứ hai chứa chuỗi t.', output: 'In độ dài dãy con chung dài nhất.',
    constraints: ['1 ≤ |s|, |t| ≤ 5000', 'Chuỗi chỉ gồm chữ cái tiếng Anh thường.'], examples: [{ input: 'abcde\nace', output: '3' }], source: 'UTH Dynamic Programming', timeLimit: '2.0 giây', memoryLimit: '256 MB',
  },
  UTH018: {
    description: ['Mô phỏng hàng đợi số nguyên với các thao tác thêm phần tử vào cuối hàng và lấy phần tử ở đầu hàng.'],
    input: 'Dòng đầu là q. Mỗi dòng tiếp theo là PUSH x hoặc POP.', output: 'Với mỗi thao tác POP, in phần tử được lấy ra. Đề bài đảm bảo hàng đợi không rỗng khi POP.',
    constraints: ['1 ≤ q ≤ 2×10^5', '-10^9 ≤ x ≤ 10^9'], examples: [{ input: '5\nPUSH 4\nPUSH 9\nPOP\nPUSH 2\nPOP', output: '4\n9' }], source: 'UTH Data Structures', ...standardLimits,
  },
}