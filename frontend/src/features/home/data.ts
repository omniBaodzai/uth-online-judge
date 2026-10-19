export type FeedItem = {
  id: string
  category: string
  title: string
  summary: string
  author: string
  date: string
  dateTime: string
  replies?: number
}

export const newsItems: FeedItem[] = [
  {
    id: 'welcome',
    category: 'Thông báo',
    title: 'Chào mừng bạn đến với UTH Online Judge',
    summary:
      'Bắt đầu hành trình luyện tập lập trình, theo dõi tiến độ và học hỏi cùng cộng đồng sinh viên UTH.',
    author: 'Ban quản trị',
    date: '18/10/2026',
    dateTime: '2026-10-18',
  },
  {
    id: 'contest',
    category: 'Cuộc thi',
    title: 'Sẵn sàng cho thử thách lập trình sắp tới',
    summary:
      'Theo dõi lịch thi và chuẩn bị kiến thức thuật toán để tự tin thử sức với những bài toán mới.',
    author: 'Ban tổ chức',
    date: '15/10/2026',
    dateTime: '2026-10-15',
  },
  {
    id: 'guide',
    category: 'Hướng dẫn',
    title: 'Một vài mẹo để bắt đầu giải bài hiệu quả',
    summary:
      'Đọc kỹ đề, thử các trường hợp biên và phân tích độ phức tạp trước khi gửi lời giải của bạn.',
    author: 'Ban quản trị',
    date: '10/10/2026',
    dateTime: '2026-10-10',
  },
  {
    id: 'update',
    category: 'Cập nhật',
    title: 'Giao diện luyện tập được tối ưu cho thiết bị di động',
    summary:
      'Các khu vực nội dung được sắp xếp lại để bạn dễ dàng theo dõi thông tin trên màn hình nhỏ.',
    author: 'Đội ngũ UTH OJ',
    date: '04/10/2026',
    dateTime: '2026-10-04',
  },
  {
    id: 'practice',
    category: 'Hướng dẫn',
    title: 'Lộ trình gợi ý cho những ngày đầu học thuật toán',
    summary:
      'Bắt đầu với điều kiện, vòng lặp, mảng và chuỗi trước khi chuyển sang các chủ đề nâng cao hơn.',
    author: 'Ban quản trị',
    date: '28/09/2026',
    dateTime: '2026-09-28',
  },
  {
    id: 'community',
    category: 'Cộng đồng',
    title: 'Cùng nhau chia sẻ cách học lập trình mỗi ngày',
    summary:
      'Một nhịp học nhỏ nhưng đều đặn sẽ giúp bạn tiến xa hơn trên hành trình chinh phục bài toán.',
    author: 'Đội ngũ UTH OJ',
    date: '20/09/2026',
    dateTime: '2026-09-20',
  },
]

export const discussionItems: FeedItem[] = [
  {
    id: 'array-prefix',
    category: 'Cấu trúc dữ liệu',
    title: 'Có thể giải bài tổng đoạn con bằng mảng cộng dồn không?',
    summary:
      'Mình đang bị TLE khi tính lại tổng cho từng truy vấn. Mọi người gợi ý giúp mình hướng tối ưu với.',
    author: 'minhtr.23',
    date: '12 phút trước',
    dateTime: '2026-10-19T13:55:00+07:00',
    replies: 8,
  },
  {
    id: 'binary-search',
    category: 'Thuật toán',
    title: 'Khi nào nên dùng tìm kiếm nhị phân trên đáp án?',
    summary:
      'Mình hiểu cách cài đặt nhưng chưa rõ dấu hiệu nhận biết tính đơn điệu trong bài toán.',
    author: 'ngocanh.dev',
    date: '35 phút trước',
    dateTime: '2026-10-19T13:32:00+07:00',
    replies: 5,
  },
  {
    id: 'graph-bfs',
    category: 'Đồ thị',
    title: 'Phân biệt BFS và DFS trong bài tìm đường đi ngắn nhất',
    summary:
      'Với đồ thị không trọng số thì BFS luôn phù hợp hơn đúng không ạ? Trường hợp nào DFS dùng được?',
    author: 'khoa_uth',
    date: '1 giờ trước',
    dateTime: '2026-10-19T12:40:00+07:00',
    replies: 4,
  },
  {
    id: 'cpp-string',
    category: 'C++',
    title: 'Lỗi vượt giới hạn khi xử lý chuỗi dài',
    summary:
      'Chương trình chạy đúng với ví dụ nhưng sai ở test lớn. Có cách nào kiểm tra giới hạn bộ nhớ không?',
    author: 'linhpham',
    date: '2 giờ trước',
    dateTime: '2026-10-19T11:45:00+07:00',
    replies: 3,
  },
  {
    id: 'dp-basic',
    category: 'Quy hoạch động',
    title: 'Bắt đầu học quy hoạch động từ dạng bài nào?',
    summary:
      'Mình đã nắm mảng và đệ quy, muốn tìm một lộ trình dễ tiếp cận để học DP.',
    author: 'tuananh_04',
    date: 'Hôm qua',
    dateTime: '2026-10-18T18:00:00+07:00',
    replies: 11,
  },
  {
    id: 'python-io',
    category: 'Python',
    title: 'Đọc dữ liệu lớn trong Python sao cho nhanh hơn?',
    summary:
      'Mọi người thường dùng cách nào để tối ưu nhập xuất khi số lượng test khá lớn?',
    author: 'baovy',
    date: 'Hôm qua',
    dateTime: '2026-10-18T16:20:00+07:00',
    replies: 6,
  },
]

export type RankedPerson = {
  name: string
  handle: string
  score: number
  scoreLabel: string
}

export const topSolvers: RankedPerson[] = [
  { name: 'Nguyễn Minh Khoa', handle: 'minhkhoa.23', score: 186, scoreLabel: 'bài AC' },
  { name: 'Trần Ngọc Anh', handle: 'ngocanh.dev', score: 172, scoreLabel: 'bài AC' },
  { name: 'Lê Hoàng Nam', handle: 'hoangnam_08', score: 159, scoreLabel: 'bài AC' },
  { name: 'Phạm Gia Bảo', handle: 'giabao.cpp', score: 143, scoreLabel: 'bài AC' },
  { name: 'Võ Thùy Linh', handle: 'linhpham', score: 128, scoreLabel: 'bài AC' },
]

export const topContributors: RankedPerson[] = [
  { name: 'Trần Ngọc Anh', handle: 'ngocanh.dev', score: 24, scoreLabel: 'bài đóng góp' },
  { name: 'Nguyễn Minh Khoa', handle: 'minhkhoa.23', score: 20, scoreLabel: 'bài đóng góp' },
  { name: 'Phạm Gia Bảo', handle: 'giabao.cpp', score: 17, scoreLabel: 'bài đóng góp' },
  { name: 'Đỗ Quỳnh Mai', handle: 'quynhmai', score: 15, scoreLabel: 'bài đóng góp' },
  { name: 'Võ Thùy Linh', handle: 'linhpham', score: 12, scoreLabel: 'bài đóng góp' },
]
