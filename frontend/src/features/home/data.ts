export type RankedPerson = {
  name: string
  handle: string
  score: number
  scoreLabel: string
  avatarUrl?: string | null
}

export const topContributors: RankedPerson[] = [
  { name: 'Trần Ngọc Anh', handle: 'ngocanh.dev', score: 24, scoreLabel: 'bài đóng góp' },
  { name: 'Nguyễn Minh Khoa', handle: 'minhkhoa.23', score: 20, scoreLabel: 'bài đóng góp' },
  { name: 'Phạm Gia Bảo', handle: 'giabao.cpp', score: 17, scoreLabel: 'bài đóng góp' },
  { name: 'Đỗ Quỳnh Mai', handle: 'quynhmai', score: 15, scoreLabel: 'bài đóng góp' },
  { name: 'Võ Thùy Linh', handle: 'linhpham', score: 12, scoreLabel: 'bài đóng góp' },
]
