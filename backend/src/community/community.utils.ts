// Tạo đường dẫn không dấu từ tiêu đề tiếng Việt.
export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
    .replace(/-+$/g, '');
}

export type Viewer = { id: string; role: 'STUDENT' | 'ADMIN' };

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
