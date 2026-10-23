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
