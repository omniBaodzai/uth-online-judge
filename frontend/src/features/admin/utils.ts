import type { AdminDifficulty, AdminProblemStatus, AdminUserAuthMethod, AdminUserRole } from './types'

export const roleLabels: Record<AdminUserRole, string> = {
  STUDENT: 'Học viên',
  ADMIN: 'Quản trị viên',
}

export const authMethodLabels: Record<AdminUserAuthMethod, string> = {
  password: 'Mật khẩu',
  google: 'Google',
  github: 'GitHub',
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export const statusLabels: Record<AdminProblemStatus, string> = {
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  archived: 'Đã lưu trữ',
}

export const difficultyLabels: Record<AdminDifficulty, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
}

export function formatDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function validateProblemCode(code: string): string | null {
  if (!/^[a-z0-9_]{1,50}$/.test(code)) {
    return 'Mã bài chỉ được chứa chữ thường a-z, số 0-9 và dấu gạch dưới (_), tối đa 50 ký tự; không dùng chữ hoa, dấu tiếng Việt, khoảng trắng hoặc ký tự đặc biệt.'
  }
  return null
}
